// Windows-only bridge for high-DPI taskbar overlays.
//
// Electron's `setOverlayIcon` crushes every image to a fixed 16x16 HICON
// (TaskbarHost::SetOverlayIcon hardcodes kOverlayIconSize = 16), which Windows
// must then upscale to the DPI-scaled taskbar slot (24x24 at 150%, 32x32 at
// 200%) — the source of the blurry, pixelated badge on 4K screens. This module
// calls ITaskbarList3::SetOverlayIcon directly through koffi and hands Windows
// an HICON whose pixel size already matches the physical taskbar slot, so the
// overlay is composed 1:1 without any scaling.
//
// Any FFI/COM failure permanently disables the bridge; callers fall back to
// Electron's setOverlayIcon.

import { createRequire } from "node:module"

// ITaskbarList3 vtable slot of SetOverlayIcon: IUnknown (0-2), ITaskbarList
// HrInit/AddTab/DeleteTab/ActivateTab/SetActiveAlt (3-7), ITaskbarList2
// MarkFullscreenWindow (8), then 9 SetProgressValue … 17 ThumbBarSetImageList,
// 18 SetOverlayIcon.
const SET_OVERLAY_ICON_SLOT = 18
const HR_INIT_SLOT = 3
const S_OK = 0
const COINIT_APARTMENTTHREADED = 0x2
const CLSCTX_INPROC_SERVER = 0x1

function guid(data1: number, data2: number, data3: number, data4: number[]) {
  const buffer = Buffer.alloc(16)
  buffer.writeUInt32LE(data1, 0)
  buffer.writeUInt16LE(data2, 4)
  buffer.writeUInt16LE(data3, 6)
  Buffer.from(data4).copy(buffer, 8)
  return buffer
}

// CLSID_TaskbarList and IID_ITaskbarList3 per ShObjIdl_core.h (Windows SDK);
// CoCreateInstance rejects the interface with E_NOINTERFACE on a wrong byte.
const CLSID_TaskbarList = guid(0x56fdf344, 0xfd6d, 0x11d0, [0x95, 0x8a, 0x00, 0x60, 0x97, 0xc9, 0xa0, 0x90])
const IID_ITaskbarList3 = guid(0xea1afb91, 0x9e28, 0x4b86, [0x90, 0xe9, 0x9e, 0x9f, 0x8a, 0x5e, 0xef, 0xaf])

type Overlay = {
  setOverlayIcon(handle: Buffer, pixels: Buffer, width: number, height: number, description: string): boolean
}

// `false` marks a permanently failed bridge; every later call falls back to Electron.
let overlay: Overlay | undefined | false

export function setTaskbarOverlayIcon(handle: Buffer, pixels: Buffer, width: number, height: number, description: string) {
  if (overlay === false) return false
  try {
    if (!overlay) overlay = createOverlay()
    if (!overlay) return false
    return overlay.setOverlayIcon(handle, pixels, width, height, description)
  } catch {
    overlay = false
    return false
  }
}

function createOverlay(): Overlay | undefined {
  if (process.platform !== "win32") return undefined
  const koffi = createRequire(import.meta.url)("koffi") as typeof import("koffi")

  const ole32 = koffi.load("ole32.dll")
  const user32 = koffi.load("user32.dll")
  const gdi32 = koffi.load("gdi32.dll")
  const ucrtbase = koffi.load("ucrtbase.dll")

  const CoInitializeEx = ole32.func("long __stdcall CoInitializeEx(void *reserved, uint32_t coinit)")
  const CoCreateInstance = ole32.func(
    "long __stdcall CoCreateInstance(const void *clsid, void *outer, uint32_t context, const void *iid, _Out_ void **out)",
  )
  const IsWindow = user32.func("int __stdcall IsWindow(void *hwnd)")
  const GetDC = user32.func("void * __stdcall GetDC(void *hwnd)")
  const ReleaseDC = user32.func("int __stdcall ReleaseDC(void *hwnd, void *hdc)")
  const DestroyIcon = user32.func("int __stdcall DestroyIcon(void *icon)")
  const ICONINFO = koffi.struct("ICONINFO", {
    fIcon: "int32_t",
    xHotspot: "uint32_t",
    yHotspot: "uint32_t",
    hbmMask: "void *",
    hbmColor: "void *",
  })
  const CreateIconIndirect = user32.func("void * __stdcall CreateIconIndirect(ICONINFO *info)")
  const CreateDIBSection = gdi32.func(
    "void * __stdcall CreateDIBSection(void *hdc, const void *bmi, uint32_t usage, _Out_ void **bits, void *section, uint32_t offset)",
  )
  const CreateBitmap = gdi32.func(
    "void * __stdcall CreateBitmap(int32_t width, int32_t height, uint32_t planes, uint32_t bits, const void *bits)",
  )
  const DeleteObject = gdi32.func("int __stdcall DeleteObject(void *handle)")
  const memcpy = ucrtbase.func("void * __stdcall memcpy(_Out_ void *dest, const void *src, size_t length)")

  const HrInit = koffi.proto("long HrInit(void *self)")
  const SetOverlayIcon = koffi.proto("long SetOverlayIcon(void *self, void *hwnd, void *icon, const char16_t *description)")

  // S_FALSE (already initialized by Chromium's STA main thread) is fine here.
  CoInitializeEx(null, COINIT_APARTMENTTHREADED)
  const instance = [null]
  if (CoCreateInstance(CLSID_TaskbarList, null, CLSCTX_INPROC_SERVER, IID_ITaskbarList3, instance) !== S_OK) return undefined
  const taskbar: unknown = instance[0]
  if (!taskbar) return undefined

  const vtable: unknown = koffi.decode(taskbar, "void *")
  if (!vtable) return undefined
  if (koffi.call(koffi.decode(vtable, HR_INIT_SLOT * 8, "void *"), HrInit, taskbar) !== S_OK) return undefined
  const setOverlayIconPtr: unknown = koffi.decode(vtable, SET_OVERLAY_ICON_SLOT * 8, "void *")
  if (!setOverlayIconPtr) return undefined

  // Electron's getNativeWindowHandle buffer has no contractual byte order; probe
  // both the native and the byte-swapped read once against IsWindow and stick
  // with whichever yields a valid window handle.
  let readHwnd: (handle: Buffer) => unknown
  const decodeHwnd = (handle: Buffer) => {
    if (readHwnd) return readHwnd(handle)
    const native: unknown = koffi.decode(handle, "void *")
    if (native && IsWindow(native)) {
      readHwnd = (buf) => koffi.decode(buf, "void *")
      return native
    }
    const swapped: unknown = koffi.decode(Buffer.from(handle).reverse(), "void *")
    if (swapped && IsWindow(swapped)) {
      readHwnd = (buf) => koffi.decode(Buffer.from(buf).reverse(), "void *")
      return swapped
    }
    readHwnd = () => null
    return null
  }

  return {
    setOverlayIcon(handle, pixels, width, height, description) {
      // 32bpp top-down DIB; the byte order of Electron's premultiplied BGRA
      // bitmaps matches the little-endian 0xAARRGGBB DIB layout byte for byte.
      const bmi = Buffer.alloc(40)
      bmi.writeUInt32LE(40, 0)
      bmi.writeInt32LE(width, 4)
      bmi.writeInt32LE(-height, 8)
      bmi.writeUInt16LE(1, 12)
      bmi.writeUInt16LE(32, 14)

      const bits = [null]
      const hdc = GetDC(null)
      const color: unknown = CreateDIBSection(hdc, bmi, 0, bits, null, 0)
      ReleaseDC(null, hdc)
      if (!color || !bits[0]) return false
      memcpy(bits[0], pixels, pixels.length)

      const mask: unknown = CreateBitmap(width, height, 1, 1, Buffer.alloc(Math.ceil(width / 32) * 4 * height))
      if (!mask) {
        DeleteObject(color)
        return false
      }

      const icon: unknown = CreateIconIndirect({ fIcon: 1, xHotspot: 0, yHotspot: 0, hbmMask: mask, hbmColor: color })
      DeleteObject(color)
      DeleteObject(mask)
      if (!icon) return false

      const hwnd = decodeHwnd(handle)
      // The taskbar keeps its own copy of the icon, so our handle can die right away.
      const result = koffi.call(setOverlayIconPtr, SetOverlayIcon, taskbar, hwnd, icon, description)
      DestroyIcon(icon)
      return result === S_OK
    },
  }
}
