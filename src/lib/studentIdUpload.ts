import { supabase } from "@/integrations/supabase/client";

export const uploadStudentId = async (userId: string, file: File) => {
  const fileExt = file.name.split(".").pop() ?? "jpg";
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("student-ids")
    .upload(fileName, file);

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("student-ids").getPublicUrl(fileName);

  return { fileName, publicUrl };
};
