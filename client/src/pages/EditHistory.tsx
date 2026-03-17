import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, Search, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ValueDiff({
  oldValue,
  newValue,
}: {
  oldValue: string | null;
  newValue: string | null;
}) {
  const empty = (v: string | null) => !v || v.trim() === "";
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <span className={`max-w-[180px] truncate ${empty(oldValue) ? "text-muted-foreground italic" : "text-red-600 line-through"}`}>
        {empty(oldValue) ? "（空）" : oldValue}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className={`max-w-[180px] truncate ${empty(newValue) ? "text-muted-foreground italic" : "text-green-700 font-medium"}`}>
        {empty(newValue) ? "（空）" : newValue}
      </span>
    </div>
  );
}

export default function EditHistory() {
  const [page, setPage] = useState(1);
  const [editedByInput, setEditedByInput] = useState("");
  const [editedByFilter, setEditedByFilter] = useState<string | undefined>(undefined);
  const PAGE_SIZE = 30;

  const { data, isLoading } = trpc.editLogs.list.useQuery({
    page,
    pageSize: PAGE_SIZE,
    editedBy: editedByFilter,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function handleSearch() {
    setPage(1);
    setEditedByFilter(editedByInput.trim() || undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  function handleClear() {
    setEditedByInput("");
    setEditedByFilter(undefined);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <Card className="shadow-sm">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="按操作人筛选..."
                value={editedByInput}
                onChange={(e) => setEditedByInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-9"
              />
            </div>
            <Button size="sm" onClick={handleSearch} className="gap-1.5">
              <Search className="h-3.5 w-3.5" />
              筛选
            </Button>
            {editedByFilter && (
              <Button size="sm" variant="ghost" onClick={handleClear} className="text-muted-foreground">
                清除筛选
              </Button>
            )}
            {data && (
              <span className="text-sm text-muted-foreground ml-auto">
                共 <strong>{data.total.toLocaleString()}</strong> 条修改记录
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 历史列表 */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            编辑历史记录
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">加载中...</div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              暂无编辑记录
              {editedByFilter && `（操作人：${editedByFilter}）`}
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/60">
                      <TableHead className="w-[160px] text-xs">时间</TableHead>
                      <TableHead className="w-[80px] text-xs">操作人</TableHead>
                      <TableHead className="text-xs">联系人</TableHead>
                      <TableHead className="w-[70px] text-xs">字段</TableHead>
                      <TableHead className="text-xs">变更内容</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((log) => {
                      const snapshot = (() => {
                        try { return JSON.parse(log.contactSnapshot || "{}"); } catch { return {}; }
                      })();
                      return (
                        <TableRow key={log.id} className="hover:bg-slate-50/80">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs font-normal">
                              {log.editedBy || "未知"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-medium text-foreground truncate max-w-[160px]">
                                {snapshot.company || "—"}
                              </p>
                              <p className="text-muted-foreground truncate max-w-[160px]">
                                {snapshot.contactName || "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">
                              {log.field}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <ValueDiff oldValue={log.oldValue} newValue={log.newValue} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片 */}
              <div className="md:hidden divide-y">
                {data.items.map((log) => {
                  const snapshot = (() => {
                    try { return JSON.parse(log.contactSnapshot || "{}"); } catch { return {}; }
                  })();
                  return (
                    <div key={log.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{snapshot.company || "—"}</p>
                          <p className="text-xs text-muted-foreground">{snapshot.contactName || "—"}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">{log.editedBy || "未知"}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{log.field}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                      </div>
                      <ValueDiff oldValue={log.oldValue} newValue={log.newValue} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="gap-1"
          >
            下一页
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
