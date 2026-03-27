import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { addEmployee, getEmployees, type EmployeeListItem, type EmployeeRole } from "@/lib/employees";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  position: "",
  dailyRate: "",
  role: "employee" as EmployeeRole,
};

export default function EmployeesPage() {
  const [list, setList] = useState<EmployeeListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const refreshEmployees = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data, error } = await getEmployees();
      if (error) {
        toast.error(error.message);
        setList([]);
        return;
      }
      setList(data);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshEmployees();
  }, [refreshEmployees]);

  async function handleAddSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First and last name are required.");
      return;
    }

    if (!form.password) {
      toast.error("Password is required.");
      return;
    }

    const dailyRateNum = Number(form.dailyRate);
    if (form.dailyRate === "" || Number.isNaN(dailyRateNum) || dailyRateNum < 0) {
      toast.error("Enter a valid daily rate.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await addEmployee({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        position: form.position.trim(),
        role: form.role,
        daily_rate: dailyRateNum,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Employee added successfully");
      setForm(emptyForm);
      setOpen(false);
      await refreshEmployees();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={loadingList}>
              <Plus className="h-4 w-4 mr-1" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="emp-first">First Name</Label>
                  <Input
                    id="emp-first"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <Label htmlFor="emp-last">Last Name</Label>
                  <Input
                    id="emp-last"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div>
                <Label htmlFor="emp-password">Password</Label>
                <Input
                  id="emp-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div>
                <Label htmlFor="emp-position">Position</Label>
                <Input
                  id="emp-position"
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div>
                <Label htmlFor="emp-rate">Daily Rate</Label>
                <Input
                  id="emp-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.dailyRate}
                  onChange={e => setForm(f => ({ ...f, dailyRate: e.target.value }))}
                  disabled={submitting}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={v => setForm(f => ({ ...f, role: v as EmployeeRole }))}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="mt-2" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  "Add Employee"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-0 shadow-sm animate-fade-up">
        <CardContent className="p-0 overflow-x-auto">
          {loadingList ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading employees…</span>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50 text-gray-600 text-sm font-medium">
                <TableRow>
                  <TableHead className="text-gray-600">Name</TableHead>
                  <TableHead className="hidden sm:table-cell text-gray-600">Email</TableHead>
                  <TableHead className="text-gray-600">Position</TableHead>
                  <TableHead className="text-gray-600">Role</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-10">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-2xl" aria-hidden>
                            👥
                          </span>
                          <p className="text-sm font-medium text-gray-600">No employees yet</p>
                          <Button variant="default" size="sm" onClick={() => setOpen(true)}>
                            Add Employee
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((emp, idx) => (
                      <TableRow
                        key={emp.id}
                        className={`hover:bg-gray-50 transition ${idx % 2 === 1 ? "bg-gray-50/60" : "bg-white"}`}
                      >
                        <TableCell className="px-4 py-3 text-sm font-medium">
                          {emp.firstName} {emp.lastName}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm hidden sm:table-cell text-muted-foreground">
                          {emp.email}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">{emp.position}</TableCell>
                        <TableCell className="px-4 py-3 text-sm capitalize">{emp.role}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
