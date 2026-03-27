import { supabase } from "@/lib/supabaseClient";

/** Storage-safe segment: letters, digits, hyphen, underscore only. */
function safeFileNameSegment(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned.length > 0 ? cleaned : "employee";
}

/**
 * Upload employee selfie via the shared Supabase client.
 * Returns public URL or throws — never succeeds without a stored object.
 */
export async function uploadSelfie(fileBlob: Blob, employee_id: string): Promise<string> {
  if (!fileBlob || fileBlob.size <= 0) {
    throw new Error("No image captured");
  }

  const id = safeFileNameSegment(employee_id);
  const fileName = `${id}-${Date.now()}.png`;

  console.log("Uploading:", fileName);

  const { data, error } = await supabase.storage.from("employee-selfies").upload(fileName, fileBlob, {
    contentType: "image/png",
    upsert: true,
  });

  if (error) {
    console.error("UPLOAD ERROR:", error);
    throw error;
  }

  if (!data) {
    console.warn("Upload returned no data payload (path may still be committed):", fileName);
  }

  const { data: publicUrl } = supabase.storage.from("employee-selfies").getPublicUrl(fileName);

  console.log("PUBLIC URL:", publicUrl.publicUrl);

  return publicUrl.publicUrl;
}

/** Same as {@link uploadSelfie} with argument order used by older call sites. */
export async function uploadEmployeeSelfie(employeeId: string, imageBlob: Blob): Promise<string> {
  return uploadSelfie(imageBlob, employeeId);
}
