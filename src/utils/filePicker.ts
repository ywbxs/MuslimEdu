/**
 * filePicker
 *
 * Phase 2 - unblocks the Materials library (spec SS5: "upload PDFs, presentations,
 * video, audio, worksheets, and references").
 *
 * The Materials backend already accepts any file type. The Materials UI could only
 * send photos, because `react-native-image-picker` was the only picker installed.
 * This module wraps both and picks the best available one at runtime:
 *
 *   - react-native-document-picker installed -> full PDF/video/audio/doc support
 *   - not installed                          -> transparent fallback to photos,
 *                                               with `degraded: true` so the caller
 *                                               can tell the user why
 *
 * That means you can merge this BEFORE running the native install, and the app
 * keeps building either way. No red screen if the pod/gradle step is pending.
 *
 * To enable full support:
 *   npm i react-native-document-picker
 *   cd ios && pod install && cd ..    # iOS only
 *   # then rebuild the app (JS-only reload is NOT enough for a native module)
 */

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number | null;
}

export interface PickResult {
  files: PickedFile[];
  cancelled: boolean;
  /** true when we had to fall back to the image-only picker */
  degraded: boolean;
}

function optionalRequire(moduleName: string): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require(moduleName);
    return mod?.default ?? mod;
  } catch (e) {
    return null;
  }
}

const DocumentPicker = optionalRequire('react-native-document-picker');
const ImagePicker = optionalRequire('react-native-image-picker');

export function isDocumentPickerAvailable(): boolean {
  return Boolean(DocumentPicker?.pick);
}

function guessMime(name: string, provided?: string | null): string {
  if (provided) return provided;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function pickWithDocumentPicker(allowMultiple: boolean): Promise<PickResult> {
  try {
    const picked = allowMultiple
      ? await DocumentPicker.pick({ allowMultiSelection: true, type: [DocumentPicker.types.allFiles] })
      : [await DocumentPicker.pickSingle({ type: [DocumentPicker.types.allFiles] })];

    const files: PickedFile[] = (picked ?? []).map((f: any) => ({
      uri: f.uri,
      name: f.name ?? 'file',
      type: guessMime(f.name ?? '', f.type),
      size: f.size ?? null,
    }));

    return { files, cancelled: false, degraded: false };
  } catch (err: any) {
    if (DocumentPicker.isCancel?.(err)) {
      return { files: [], cancelled: true, degraded: false };
    }
    throw err;
  }
}

async function pickWithImagePicker(allowMultiple: boolean): Promise<PickResult> {
  if (!ImagePicker?.launchImageLibrary) {
    throw new Error('No file picker is available in this build.');
  }

  const res = await ImagePicker.launchImageLibrary({
    mediaType: 'mixed',
    selectionLimit: allowMultiple ? 0 : 1,
  });

  if (res?.didCancel) {
    return { files: [], cancelled: true, degraded: true };
  }
  if (res?.errorCode) {
    throw new Error(res.errorMessage ?? 'Could not open the photo library.');
  }

  const files: PickedFile[] = (res?.assets ?? []).map((a: any) => ({
    uri: a.uri,
    name: a.fileName ?? `upload-${Date.now()}.jpg`,
    type: guessMime(a.fileName ?? '', a.type),
    size: a.fileSize ?? null,
  }));

  return { files, cancelled: false, degraded: true };
}

/** Single entry point. Use this everywhere instead of calling a picker directly. */
export async function pickFiles(allowMultiple = false): Promise<PickResult> {
  if (isDocumentPickerAvailable()) {
    return pickWithDocumentPicker(allowMultiple);
  }
  return pickWithImagePicker(allowMultiple);
}

/** Ready to append straight onto a FormData for the materials upload endpoint. */
export function toFormDataPart(file: PickedFile) {
  return { uri: file.uri, name: file.name, type: file.type } as any;
}
