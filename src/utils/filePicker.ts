/**
 * filePicker
 *
 * Phase 2 - unblocks the Materials library (spec SS5: "upload PDFs, presentations,
 * video, audio, worksheets, and references").
 *
 * Single entry point (`pickFiles`) over `@react-native-documents/picker`, the
 * document picker TeacherMaterialsScreen already uses directly. Both it and
 * `react-native-image-picker` are real dependencies (see package.json), so
 * this wraps them with static `require`/`import` calls only - Metro resolves
 * its dependency graph by statically parsing `require`/`import` calls, so a
 * *dynamic* `require(moduleName)` (a variable, not a string literal) fails
 * the whole bundle with "Invalid call ... require(moduleName)" even when
 * wrapped in try/catch, regardless of whether the module is installed.
 */
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';

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
    const picked = await pick({ type: [types.allFiles], allowMultiSelection: allowMultiple });

    const files: PickedFile[] = (picked ?? []).map((f) => ({
      uri: f.uri,
      name: f.name ?? 'file',
      type: guessMime(f.name ?? '', f.type),
      size: f.size ?? null,
    }));

    return { files, cancelled: false, degraded: false };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return { files: [], cancelled: true, degraded: false };
    }
    throw err;
  }
}

async function pickWithImagePicker(allowMultiple: boolean): Promise<PickResult> {
  const res = await launchImageLibrary({
    mediaType: 'mixed',
    selectionLimit: allowMultiple ? 0 : 1,
  });

  if (res?.didCancel) {
    return { files: [], cancelled: true, degraded: true };
  }
  if (res?.errorCode) {
    throw new Error(res.errorMessage ?? 'Could not open the photo library.');
  }

  const files: PickedFile[] = (res?.assets ?? []).map((a) => ({
    uri: a.uri ?? '',
    name: a.fileName ?? `upload-${Date.now()}.jpg`,
    type: guessMime(a.fileName ?? '', a.type),
    size: a.fileSize ?? null,
  }));

  return { files, cancelled: false, degraded: true };
}

/**
 * Single entry point. Use this everywhere instead of calling a picker
 * directly. Prefers the full document picker (PDFs, video, audio, office
 * docs); if it fails for a reason other than the user cancelling (e.g. the
 * native module isn't linked in this particular build), falls back to the
 * photo-only picker so uploading isn't completely blocked.
 */
export async function pickFiles(allowMultiple = false): Promise<PickResult> {
  try {
    return await pickWithDocumentPicker(allowMultiple);
  } catch (err) {
    return pickWithImagePicker(allowMultiple);
  }
}

/** Ready to append straight onto a FormData for the materials upload endpoint. */
export function toFormDataPart(file: PickedFile) {
  return { uri: file.uri, name: file.name, type: file.type } as any;
}
