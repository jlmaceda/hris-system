import { useState } from "react";
import { allowances as initAllowances, benefits as initBenefits, deductions as initDeductions } from "@/lib/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CompensationPage() {
  const [allowances, setAllowances] = useState(initAllowances);
  const [benefits, setBenefits] = useState(initBenefits);
  const [deductionsList, setDeductions] = useState(initDeductions);
  const [modal, setModal] = useState<{ type: string; mode: string } | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Compensation</h1>
      <Tabs defaultValue="allowances">
        <TabsList>
          <TabsTrigger value="allowances">Allowances</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
        </TabsList>

        <TabsContent value="allowances" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex justify-end p-4 pb-0">
                <Button size="sm" onClick={() => toast.info("Add allowance modal")}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50 text-gray-600 text-sm font-medium">
                    <TableRow>
                      <TableHead className="text-gray-600">Name</TableHead>
                      <TableHead className="text-gray-600">Type</TableHead>
                      <TableHead className="text-right text-gray-600">Amount</TableHead>
                      <TableHead className="w-24 text-gray-600" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allowances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-10">
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-2xl" aria-hidden>
                              📄
                            </span>
                            <p className="text-sm font-medium text-gray-600">No allowances yet</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      allowances.map((a, idx) => (
                        <TableRow
                          key={a.id}
                          className={`hover:bg-gray-50 transition ${idx % 2 === 1 ? "bg-gray-50/60" : "bg-white"}`}
                        >
                          <TableCell className="px-4 py-3 text-sm font-medium">{a.name}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-muted-foreground">{a.type}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-right tabular-nums">
                            ₱{a.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm flex gap-1 justify-end">
                            <Button size="icon" variant="ghost">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setAllowances(prev => prev.filter(x => x.id !== a.id));
                                toast.success("Deleted");
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benefits" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex justify-end p-4 pb-0"><Button size="sm" onClick={() => toast.info("Add benefit modal")}><Plus className="h-4 w-4 mr-1" />Add</Button></div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50 text-gray-600 text-sm font-medium">
                    <TableRow>
                      <TableHead className="text-gray-600">Name</TableHead>
                      <TableHead className="text-gray-600">Description</TableHead>
                      <TableHead className="w-24 text-gray-600" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {benefits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-10">
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-2xl" aria-hidden>
                              📄
                            </span>
                            <p className="text-sm font-medium text-gray-600">No benefits yet</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      benefits.map((b, idx) => (
                        <TableRow
                          key={b.id}
                          className={`hover:bg-gray-50 transition ${idx % 2 === 1 ? "bg-gray-50/60" : "bg-white"}`}
                        >
                          <TableCell className="px-4 py-3 text-sm font-medium">{b.name}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-muted-foreground">{b.description}</TableCell>
                          <TableCell className="px-4 py-3 text-sm flex gap-1 justify-end">
                            <Button size="icon" variant="ghost">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setBenefits(prev => prev.filter(x => x.id !== b.id));
                                toast.success("Deleted");
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deductions" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="flex justify-end p-4 pb-0"><Button size="sm" onClick={() => toast.info("Add deduction modal")}><Plus className="h-4 w-4 mr-1" />Add</Button></div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50 text-gray-600 text-sm font-medium">
                    <TableRow>
                      <TableHead className="text-gray-600">Name</TableHead>
                      <TableHead className="text-gray-600">Type</TableHead>
                      <TableHead className="text-right text-gray-600">Amount</TableHead>
                      <TableHead className="w-24 text-gray-600" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductionsList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 py-10">
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-2xl" aria-hidden>
                              📄
                            </span>
                            <p className="text-sm font-medium text-gray-600">No deductions yet</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      deductionsList.map((d, idx) => (
                        <TableRow
                          key={d.id}
                          className={`hover:bg-gray-50 transition ${idx % 2 === 1 ? "bg-gray-50/60" : "bg-white"}`}
                        >
                          <TableCell className="px-4 py-3 text-sm font-medium">{d.name}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-muted-foreground">{d.type}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-right tabular-nums">
                            ₱{d.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm flex gap-1 justify-end">
                            <Button size="icon" variant="ghost">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setDeductions(prev => prev.filter(x => x.id !== d.id));
                                toast.success("Deleted");
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
