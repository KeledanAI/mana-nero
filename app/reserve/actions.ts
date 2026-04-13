"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createProductRequestRecord } from "@/lib/domain/product-requests";
import { createClient } from "@/lib/supabase/server";

export async function createProductRequest(formData: FormData) {
  const productName = String(formData.get("product_name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const quantityRaw = String(formData.get("quantity") || "").trim();
  const desiredPriceRaw = String(formData.get("desired_price") || "").trim();
  const priorityFlag = formData.get("priority_flag") === "on";

  if (!productName) {
    redirect("/reserve?error=product_name_required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  let errorMessage: string | undefined;

  try {
    await createProductRequestRecord(supabase, {
      userId: user.id,
      productName,
      category: category || null,
      notes: notes || null,
      quantity: quantityRaw ? Number.parseInt(quantityRaw, 10) : null,
      desiredPrice: desiredPriceRaw ? Number.parseFloat(desiredPriceRaw) : null,
      priorityFlag,
    });
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "product_request_failed";
  }

  revalidatePath("/reserve");
  revalidatePath("/protected");

  if (errorMessage) {
    redirect(`/reserve?error=${encodeURIComponent(errorMessage)}`);
  }

  redirect("/reserve?success=created");
}
