import type {OrderStatus} from "../../api/orderCatalog.api";
export const orderStatusLabel:Record<OrderStatus,string>={WAITING:"Menunggu",PROCESSING:"Diproses",COMPLETED:"Selesai"};
const colors:Record<OrderStatus,string>={WAITING:"bg-amber-50 text-amber-700",PROCESSING:"bg-blue-50 text-blue-700",COMPLETED:"bg-green-50 text-green-700"};
export default function OrderStatusBadge({status}:{status:OrderStatus}){return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${colors[status]||colors.WAITING}`}>{orderStatusLabel[status]||"Menunggu"}</span>}
