import "server-only";

import { isArchivedCustomer, isDeletedCustomer } from "@/lib/customer-visibility";
import { supabaseRest } from "@/lib/supabase";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CompanyRow = {
  id: string;
  name?: string | null;
  status?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};

export type OperationalCustomerCheck =
  | { ok: true; company: CompanyRow }
  | { ok: false; status: 400 | 404 | 409 | 503; error: string };

export async function checkOperationalCustomer(companyId: unknown): Promise<OperationalCustomerCheck> {
  const id = String(companyId || "");
  if (!uuidPattern.test(id)) return { ok: false, status: 400, error: "Geçerli bir müşteri seçin." };

  let rows: CompanyRow[];
  try {
    rows = await supabaseRest<CompanyRow[]>(
      `companies?id=eq.${encodeURIComponent(id)}&select=id,name,status,archived_at,deleted_at&limit=1`
    );
  } catch {
    return { ok: false, status: 503, error: "Müşteri durumu doğrulanamadı. Lütfen tekrar deneyin." };
  }
  const company = rows[0];
  if (!company || isDeletedCustomer(company)) return { ok: false, status: 404, error: "Müşteri bulunamadı." };
  if (isArchivedCustomer(company)) {
    return { ok: false, status: 409, error: "Arşivlenmiş müşteri yeni bir işleme bağlanamaz. Önce müşteriyi arşivden çıkarın." };
  }
  return { ok: true, company };
}
