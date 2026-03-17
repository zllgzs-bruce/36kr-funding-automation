import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Building2,
  User,
  Briefcase,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const PAGE_SIZE = 20;

type ContactItem = {
  id: number;
  company: string | null;
  contactName: string | null;
  title: string | null;
  phone: string | null;
  phoneType: string | null;
  phoneValid: number | null;
  email: string | null;
  sourceFile: string | null;
  sourceLabel: string | null;
  priorityTime: number | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default function Contacts() {
  const { user } = useAuth();
  const [searchCompany, setSearchCompany] = useState("");
  const [searchContact, setSearchContact] = useState("");
  const [queryCompany, setQueryCompany] = useState("");
  const [queryContact, setQueryContact] = useState("");
  const [page, setPage] = useState(1);
  const [editContact, setEditContact] = useState<ContactItem | null>(null);
  const [editForm, setEditForm] = useState({ company: "", contactName: "", title: "", phone: "", email: "" });

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.contacts.search.useQuery({
    company: queryCompany || undefined,
    contactName: queryContact || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("联系人信息已更新");
      setEditContact(null);
      utils.contacts.search.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "更新失败");
    },
  });

  const handleSearch = useCallback(() => {
    setPage(1);
    setQueryCompany(searchCompany.trim());
    setQueryContact(searchContact.trim());
  }, [searchCompany, searchContact]);

  const handleClearSearch = () => {
    setSearchCompany("");
    setSearchContact("");
    setQueryCompany("");
    setQueryContact("");
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const openEdit = (contact: ContactItem) => {
    setEditContact(contact);
    setEditForm({
      company: contact.company || "",
      contactName: contact.contactName || "",
      title: contact.title || "",
      phone: contact.phone || "",
      email: contact.email || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editContact) return;
    updateMutation.mutate({
      id: editContact.id,
      company: editForm.company || undefined,
      contactName: editForm.contactName || undefined,
      title: editForm.title || undefined,
      phone: editForm.phone || undefined,
      email: editForm.email || undefined,
    });
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const hasSearch = queryCompany || queryContact;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* 搜索区域 */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索公司名..."
              value={searchCompany}
              onChange={(e) => setSearchCompany(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <div className="relative flex-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索联系人姓名..."
              value={searchContact}
              onChange={(e) => setSearchContact(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSearch} className="gap-2 shrink-0">
              <Search className="h-4 w-4" />
              搜索
            </Button>
            {hasSearch && (
              <Button variant="outline" onClick={handleClearSearch} className="gap-2 shrink-0">
                <X className="h-4 w-4" />
                清除
              </Button>
            )}
          </div>
        </div>
        {/* 搜索结果统计 */}
        {data && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            {hasSearch ? (
              <>
                <span>找到 <strong className="text-foreground">{data.total.toLocaleString()}</strong> 条结果</span>
                {queryCompany && <Badge variant="secondary" className="text-xs">公司: {queryCompany}</Badge>}
                {queryContact && <Badge variant="secondary" className="text-xs">联系人: {queryContact}</Badge>}
              </>
            ) : (
              <span>共 <strong className="text-foreground">{data.total.toLocaleString()}</strong> 条联系人记录</span>
            )}
          </div>
        )}
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
            <Search className="h-10 w-10 opacity-30" />
            <p className="text-sm">{hasSearch ? "未找到匹配的联系人" : "暂无数据"}</p>
          </div>
        ) : (
          <>
            {/* 桌面端表格 */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-[200px]">公司名</TableHead>
                    <TableHead className="w-[100px]">联系人</TableHead>
                    <TableHead className="w-[150px]">职位</TableHead>
                    <TableHead className="w-[140px]">电话</TableHead>
                    <TableHead className="w-[200px]">邮箱</TableHead>
                    <TableHead className="w-[120px]">来源标签</TableHead>
                    <TableHead className="w-[60px] text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((contact) => (
                    <TableRow key={contact.id} className="hover:bg-blue-50/30 transition-colors">
                      <TableCell className="font-medium max-w-[200px]">
                        <span className="truncate block" title={contact.company || ""}>
                          {contact.company || <span className="text-muted-foreground italic text-xs">未知</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        {contact.contactName ? (
                          <span className="truncate block max-w-[100px]" title={contact.contactName}>
                            {contact.contactName.length > 10 ? contact.contactName.slice(0, 10) + "…" : contact.contactName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="truncate block max-w-[150px] text-sm" title={contact.title || ""}>
                          {contact.title || <span className="text-muted-foreground italic text-xs">-</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        {contact.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-sm font-mono">
                              {contact.phone.length > 15 ? contact.phone.slice(0, 15) + "…" : contact.phone}
                            </span>
                            {contact.phoneType === "mobile" && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">手机</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate max-w-[160px]" title={contact.email}>
                              {contact.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.sourceLabel ? (
                          <Badge variant="secondary" className="text-xs truncate max-w-[100px]" title={contact.sourceLabel}>
                            {contact.sourceLabel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary"
                          onClick={() => openEdit(contact as ContactItem)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 移动端卡片列表 */}
            <div className="md:hidden divide-y">
              {data.items.map((contact) => (
                <div key={contact.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">
                          {contact.company || <span className="text-muted-foreground italic">未知公司</span>}
                        </span>
                        {contact.sourceLabel && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">{contact.sourceLabel}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        {contact.contactName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {contact.contactName.length > 15 ? contact.contactName.slice(0, 15) + "…" : contact.contactName}
                          </span>
                        )}
                        {contact.title && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {contact.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                            <Phone className="h-3 w-3" />
                            {contact.phone.length > 15 ? contact.phone.slice(0, 15) + "…" : contact.phone}
                          </a>
                        )}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm text-blue-600 hover:underline truncate max-w-[200px]">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => openEdit(contact as ContactItem)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border shadow-sm px-4 py-3">
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* 页码显示 */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    disabled={isLoading}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              编辑联系人
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-company">公司名</Label>
              <Input
                id="edit-company"
                value={editForm.company}
                onChange={(e) => setEditForm(f => ({ ...f, company: e.target.value }))}
                placeholder="公司名称"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-contact">联系人姓名</Label>
              <Input
                id="edit-contact"
                value={editForm.contactName}
                onChange={(e) => setEditForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="联系人姓名"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">职位</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                placeholder="职位"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">电话</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="电话号码"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">邮箱</Label>
              <Input
                id="edit-email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                placeholder="邮箱地址"
              />
            </div>
            {editContact?.sourceFile && (
              <div className="text-xs text-muted-foreground bg-slate-50 rounded-lg p-3">
                <span className="font-medium">来源文件：</span>{editContact.sourceFile}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditContact(null)} disabled={updateMutation.isPending}>
              取消
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
