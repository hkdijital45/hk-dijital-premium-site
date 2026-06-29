export type ActionResultStatus = "success" | "prepared" | "warning" | "error";

export type ActionResultRecord = {
  label: string;
  count?: number;
  status?: string;
  href?: string;
  detail?: string;
};

export type ActionResultLink = {
  label: string;
  href?: string;
  onClickKey?: string;
  detail?: string;
};

export type ActionResult = {
  title: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  companyId?: string;
  branchId?: string;
  status: ActionResultStatus;
  createdRecords?: ActionResultRecord[];
  nextActions?: string[];
  checkLinks?: ActionResultLink[];
  customerVisibility?: {
    showToCustomer?: boolean;
    label?: string;
  };
  technicalDetails?: Record<string, unknown>;
};

export function buildActionResult(result: ActionResult) {
  return {
    success: result.status !== "error",
    message: result.status === "error" ? "İşlem tamamlanamadı." : "İşlem başarıyla tamamlandı.",
    actionResult: result
  };
}
