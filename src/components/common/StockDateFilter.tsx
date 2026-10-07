import { useSearchParams } from "react-router-dom";
import { currentBusinessDate, formatBusinessDate } from "../../utils/businessDate";
import { useAuth } from "../../app/AuthContext";
import { getUserRoleNames } from "../../app/roleAccess";

export default function StockDateFilter() {
 const [params,setParams]=useSearchParams();
 const {user}=useAuth();const roles=getUserRoleNames(user);
 const todayOnly=roles.includes("inventory")&&!roles.some(role=>["admin","leader"].includes(role));
 const date=params.get("date")||currentBusinessDate();
 function changeDate(value:string){setParams(current=>{const next=new URLSearchParams(current);if(value)next.set("date",value);else next.delete("date");return next;});}
 return <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4"><label className="flex items-center gap-2 text-sm font-semibold">Tanggal stok<input type="date" aria-label="Tanggal stok" max={currentBusinessDate()} disabled={todayOnly} value={date} onChange={event=>changeDate(event.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm" /></label><button type="button" onClick={()=>changeDate("")} className="rounded-lg border px-3 py-2 text-xs font-semibold">Stok terbaru</button><p className="text-xs text-stone-600">{date===currentBusinessDate()?"Stok terbaru yang tercatat":`Riwayat · posisi stok akhir ${formatBusinessDate(date)}`}</p></div>;
}
