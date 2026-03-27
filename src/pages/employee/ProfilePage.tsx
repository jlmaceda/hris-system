import { Card, CardContent } from "@/components/ui/card";
import { UserCircle } from "lucide-react";

const profile = {
  name: "Maria Santos",
  position: "Fitness Trainer",
  branch: "Main Branch",
  dailyRate: 850,
  email: "maria.santos@fitnessdepot.com",
};

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
      <Card className="border-0 shadow-sm animate-fade-up max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCircle className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">{profile.position}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <Row label="Email" value={profile.email} />
            <Row label="Branch" value={profile.branch} />
            <Row label="Daily Rate" value={`₱${profile.dailyRate.toLocaleString()}`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
