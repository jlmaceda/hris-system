import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock } from "lucide-react";
import { toast } from "sonner";

export default function PayslipPage() {
  const [requested, setRequested] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Payslip</h1>
      <Card className="border-0 shadow-sm animate-fade-up max-w-md">
        <CardContent className="p-6 space-y-4 text-center">
          {!requested ? (
            <>
              <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground text-sm">Request your latest payslip from HR.</p>
              <Button className="active:scale-[0.97] transition-transform" onClick={() => { setRequested(true); toast.success("Payslip requested!"); }}>
                Request Payslip
              </Button>
            </>
          ) : (
            <>
              <Clock className="h-12 w-12 text-warning mx-auto" />
              <p className="font-medium">Payslip Requested</p>
              <p className="text-sm text-muted-foreground">Your request is being processed. You will be notified once it's ready.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
