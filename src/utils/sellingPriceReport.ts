import * as XLSX from "xlsx-js-style";
import { getSellingHistory, type SellingRow } from "../api/sellingPrice.api";
import { createExportWorksheet } from "./exportWorksheet";
const labels = ["Overhead", "Variable", "Meal Allowance", "Capital Ex", "Labour", "Rent Ex", "Margin"];
function percentageFormat(value: number) {
 const percent = Number((value * 100).toFixed(6));
 const decimals = (String(percent).split(".")[1] || "").length;
 return decimals ? `0.${"0".repeat(decimals)}%` : "0%";
}
function format(sheet: XLSX.WorkSheet, percentColumns: number[] = []) {
 if (!sheet["!ref"]) return;
 const range = XLSX.utils.decode_range(sheet["!ref"]);
 sheet["!autofilter"] = {ref: sheet["!ref"]};
 for (let r=1;r<=range.e.r;r++) for (let c=0;c<=range.e.c;c++) {
  const cell=sheet[XLSX.utils.encode_cell({r,c})];if(!cell)continue;
  if(cell.t==="n")cell.z=percentColumns.includes(c)?percentageFormat(Number(cell.v)):"#,##0";
  cell.s={...cell.s,alignment:{horizontal:cell.t==="n"?"right":"left",vertical:"center",wrapText:true}};
 }
}
export function buildSellingPriceWorkbook(rows: SellingRow[],period:string) {
 const book=XLSX.utils.book_new();
 const summary=createExportWorksheet(
  ["Periode","Menu","Kategori","Resep","Versi harga","Status","HPP resep (Rp)",...labels.map(label=>`${label} (%)`),"Total HPP (Rp)","Harga jual (Rp)","Surplus (Rp)","Disimpan"],
  rows.map(row=>{const {source,calculation}=row.snapshot;return [row.period,source.product_name,source.category_name,source.version,row.revision,row.active?"Aktif":"Nonaktif",Number(calculation.base_hpp),...labels.map(label=>Number(calculation.components.find(c=>c.label===label)?.percent||0)/100),Number(calculation.total_hpp),Number(calculation.selling_price),Number(calculation.surplus),new Date(row.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})]}),
  [14,32,22,24,14,14,22,...labels.map(()=>20),22,22,22,25],
 );
 format(summary,[7,8,9,10,11,12,13]);
 XLSX.utils.book_append_sheet(book,summary,"Harga Penjualan");
 const detailRows:(string|number)[][]=[];
 for(const row of rows){const {source,calculation}=row.snapshot;const prefix=[row.period,source.product_name,source.category_name,source.version,row.revision,row.active?"Aktif":"Nonaktif"];
  detailRows.push([...prefix,"HPP resep","",Number(calculation.base_hpp)]);
  for(const c of calculation.components)detailRows.push([...prefix,c.label,Number(c.percent)/100,Number(c.amount)]);
  for(const [label,value] of [["Total HPP",calculation.total_hpp],["Harga jual",calculation.selling_price],["Surplus",calculation.surplus]])detailRows.push([...prefix,label,"",Number(value)]);
 }
 const details=createExportWorksheet(["Periode","Menu","Kategori","Resep","Versi harga","Status","Komponen","Persen","Nominal (Rp)"],detailRows,[14,32,22,24,14,14,24,16,24]);
 format(details,[7]);XLSX.utils.book_append_sheet(book,details,"Rincian Biaya");
 XLSX.utils.book_append_sheet(book,createExportWorksheet(["Keterangan","Nilai"],[
  ["Periode",period],["Jumlah versi",rows.length],["Harga aktif",rows.filter(r=>r.active).length],
  ["Cakupan","Semua versi harga tersimpan pada bulan pilihan, aktif maupun nonaktif. Data yang dihapus tidak disertakan."],
  ["Sumber","Snapshot saat versi disimpan; HPP dan persentase tidak dihitung ulang dari harga bahan terbaru. Status aktif mengikuti keadaan saat ekspor."],
  ["Rumus","Komponen = HPP resep × persen. Total HPP = HPP resep + semua komponen. Surplus = harga jual − total HPP."],
  ["Angka","Rupiah ditampilkan bulat dengan pemisah ribuan; nilai asli tetap presisi. Persentase disimpan sebagai angka persen Excel."],
 ],[25,105]),"Informasi");return book;
}
export async function exportSellingPrices(period:string) {
 const rows:SellingRow[]=[];
 for(let start=0;;start+=50){const response=await getSellingHistory(period,start);if(response.error)throw new Error(response.message||"Gagal mengambil harga penjualan.");const page=response.data||[];rows.push(...page);if(page.length<50)break;}
 if(!rows.length)throw new Error("Belum ada harga penjualan tersimpan pada bulan ini.");
 XLSX.writeFile(buildSellingPriceWorkbook(rows,period),`HPP-Harga-Penjualan-${period}.xlsx`);
 return rows.length;
}
