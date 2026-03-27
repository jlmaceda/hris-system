import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, Phone, Mail } from "lucide-react";
import { branches } from "@/lib/mock-data";

export default function CompanyProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Company Profile</h1>
      <Card className="border-0 shadow-sm animate-fade-up max-w-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Fitness Depot</CardTitle>
              <p className="text-sm text-muted-foreground">Health & Fitness Company</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Contact Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />(02) 8123-4567</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />hr@fitnessdepot.com</div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Branches</h3>
            <div className="space-y-2">
              {branches.map(b => (
                <div key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" />{b}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
