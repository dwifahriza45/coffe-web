import {useEffect,useState} from "react";
import {Pencil} from "lucide-react";
import {isAxiosError} from "axios";
import {useAuth} from "../../app/AuthContext";
import {userCan} from "../../app/roleAccess";
import {useLanguage} from "../../app/LanguageContext";
import {getPurchaseOrderDetail,type SupplierTransaction} from "../../api/supplier.api";
import {formatBusinessDate} from "../../utils/businessDate";
import CreatePurchaseOrder from "./CreatePurchaseOrder";
const money=(value:string|null)=>value===null?"—":new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value));
const quantity=(value:string)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:4}).format(Number(value));
export default function PurchaseOrderDetail({supplierID,detailID,status,onUpdated}:{supplierID:string;detailID:string;status:string;onUpdated:()=>void}){
 const {t}=useLanguage();const {user}=useAuth();const canEdit=userCan(user,"purchase_orders","update")&&status==="PENDING";
 const [transaction,setTransaction]=useState<SupplierTransaction|null>(null),[error,setError]=useState(""),[editing,setEditing]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let active=true;setTransaction(null);setError("");getPurchaseOrderDetail(supplierID,detailID).then(r=>{if(active)setTransaction(r.data)}).catch(e=>{if(active)setError(isAxiosError<{message?:string}>(e)?e.response?.data?.message||"Gagal memuat detail PO.":"Gagal memuat detail PO.")});return()=>{active=false}},[supplierID,detailID,refresh]);
 if(error)return <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>;
 if(!transaction)return <p role="status" className="mt-5 text-sm text-stone-500">Memuat detail PO…</p>;
 return <div className="mt-5">
                            <details
                              open={transaction.source !== "shopping"}
                              className="rounded-xl border border-stone-200 bg-white"
                            >
                              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-stone-700">
                                {t(
                                  transaction.source === "shopping"
                                    ? "Order details and delivery information"
                                    : "Transaction details",
                                )}
                              </summary>
                              <div className="border-t border-stone-100 p-5">
                                <div className="mb-4 flex flex-wrap justify-between gap-3 text-sm">
                                  <p>
                                    <span className="text-stone-500">
                                      {t("Created by")}:{" "}
                                    </span>
                                    {transaction.created_by || "—"}
                                  </p>
                                </div>
                                {transaction.source === "shopping" && (
                                  <>
                                    <dl className="mb-4 grid gap-4 rounded-lg border border-stone-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                      {[
                                        [
                                          "Delivery date",
                                          formatBusinessDate(
                                            transaction.delivery_date ||
                                              undefined,
                                          ),
                                        ],
                                        [
                                          "Payment method",
                                          transaction.payment_method,
                                        ],
                                        [
                                          "Supplier bank account",
                                          transaction.bank_account,
                                        ],
                                        ["Ship to", transaction.ship_to],
                                        ["Recipient", transaction.recipient],
                                        [
                                          "Shipping address",
                                          transaction.shipping_address,
                                        ],
                                        [
                                          "Shipping phone",
                                          transaction.shipping_phone,
                                        ],
                                      ].map(([label, value]) => (
                                        <div key={label}>
                                          <dt className="text-xs font-semibold text-stone-500">
                                            {t(label)}
                                          </dt>
                                          <dd className="mt-1 whitespace-pre-wrap">
                                            {value || "—"}
                                          </dd>
                                        </div>
                                      ))}
                                    </dl>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold hover:bg-stone-100"
                                        onClick={() => {
                                          setEditing(true);
                                        }}
                                      >
                                        <Pencil size={14} />
                                        {t("Edit purchase order")}
                                      </button>
                                    )}
                                  </>
                                )}
                                {transaction.notes && (
                                  <p className="mb-4 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm text-stone-600">
                                    {transaction.notes}
                                  </p>
                                )}
                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-160 text-left text-sm">
                                    <thead className="bg-[var(--color-brand-accent)] text-xs text-white">
                                      <tr>
                                        {[
                                          "No",
                                          "Ingredient",
                                          "Brand / Type",
                                          "Qty",
                                          "Packaging / Unit",
                                          "Price",
                                          "Content Qty",
                                          "Content unit",
                                          "Total",
                                          ...(transaction.source === "shopping"
                                            ? []
                                            : ["Notes"]),
                                        ].map((label) => (
                                          <th key={label} className="px-3 py-3">
                                            {t(label)}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 bg-white">
                                      {transaction.items.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={
                                              transaction.source === "shopping"
                                                ? 9
                                                : 10
                                            }
                                            className="p-5 text-center text-stone-500"
                                          >
                                            {t("No transaction items")}
                                          </td>
                                        </tr>
                                      ) : (
                                        transaction.items.map((item, index) => (
                                          <tr key={index}>
                                            <td className="px-3 py-3">
                                              {index + 1}
                                            </td>
                                            <td className="px-3 py-3 font-medium">
                                              {item.name}
                                            </td>
                                            <td className="px-3 py-3">
                                              {item.brand || "—"}
                                            </td>
                                            <td className="px-3 py-3">
                                              {quantity(item.quantity)}
                                            </td>
                                            <td className="px-3 py-3">
                                              {item.unit || "—"}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3">
                                              {money(item.unit_price)}
                                            </td>
                                            <td className="px-3 py-3">
                                              {item.content_qty
                                                ? quantity(item.content_qty)
                                                : "—"}
                                            </td>
                                            <td className="px-3 py-3">
                                              {item.content_unit || "—"}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3">
                                              {money(item.total)}
                                            </td>
                                            {transaction.source !==
                                              "shopping" && (
                                              <td className="max-w-xs whitespace-pre-wrap px-3 py-3">
                                                {item.notes || "—"}
                                              </td>
                                            )}
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                                {transaction.source === "receipt" && (
                                  <p className="mt-3 text-xs text-stone-500">
                                    {t("Receipt prices are not recorded")}
                                  </p>
                                )}
                              </div>
                            </details>
 {editing&&<CreatePurchaseOrder supplierID={supplierID} editing={transaction} onClose={()=>setEditing(false)} onSaved={()=>{setEditing(false);setRefresh(value=>value+1);onUpdated()}}/>}
 </div>;
}
