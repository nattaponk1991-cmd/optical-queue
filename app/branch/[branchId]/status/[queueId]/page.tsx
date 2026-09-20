"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function QueueStatusPage() {
  const params = useParams();
  const queueId = params.queueId as string;
  const router = useRouter();

  const [queue, setQueue] = useState<any>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [queuesAhead, setQueuesAhead] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!queueId) return;

    // ติดตามข้อมูลคิวปัจจุบัน
    const unsubQueue = onSnapshot(doc(db, "queues", queueId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setQueue({ id: docSnap.id, ...data });
        if (data.customerName) setCustomerName(data.customerName);
        if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      }
    });

    return () => unsubQueue();
  }, [queueId]);

  useEffect(() => {
    if (!queue) return;

    // คำนวณจำนวนคิวก่อนหน้า
    const q = query(
      collection(db, "queues"),
      where("branchId", "==", queue.branchId),
      where("status", "==", "WAITING")
    );

    const unsubAllWaiting = onSnapshot(q, (snapshot) => {
      let totalWaiting = 0;
      let ahead = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        totalWaiting++;

        if (data.type === queue.type && data.queueNumber < queue.queueNumber) {
          ahead++;
        }
      });

      setWaitingCount(totalWaiting);
      setQueuesAhead(ahead);
    });

    return () => unsubAllWaiting();
  }, [queue]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phoneNumber.trim()) {
      alert("กรุณากรอกชื่อและเบอร์โทรศัพท์ให้ครบถ้วน");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "queues", queueId), {
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      alert("ลงทะเบียนข้อมูลเรียบร้อยแล้ว!");
    } catch (error) {
      console.error("Error updating queue registration:", error);
      alert("เกิดข้อผิดพลาดในการลงทะเบียน");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!queue) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <p className="text-gray-500 font-medium animate-pulse">กำลังโหลดข้อมูลคิว...</p>
      </div>
    );
  }

  const isRegistered = queue.customerName && queue.phoneNumber;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 space-y-6">
        
        {/* ฟอร์มลงทะเบียน (กรณีลูกค้ายังไม่กรอกข้อมูล) */}
        {!isRegistered ? (
          <div className="space-y-5 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-black text-gray-800">🎉 คุณได้รับคิวแล้ว!</p>
              <p className="text-xs text-gray-500 font-semibold">หมายเลขคิวของคุณคือ</p>
            </div>

            <div className="py-2">
              <span className="text-6xl font-black text-blue-600 tracking-tight">{queue.queueNumber}</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 font-medium">
              ⚠️ กรุณากรอกข้อมูลด้านล่าง เพื่อยืนยันการรับคิว <br />
              หากไม่กรอกข้อมูล ระบบจะไม่สามารถเรียกคิวของคุณได้
            </div>

            {/* ข้อความแจ้งเตือน 15 นาที */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-2.5 text-[11px] text-red-600 font-bold">
              * หากถึงคิวแล้วไม่แสดงตนภายใน 15 นาที ถือว่าท่านสละสิทธิ์
            </div>

            <form onSubmit={handleRegister} className="space-y-4 text-left pt-2">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อ - นามสกุล</label>
                <input
                  type="text"
                  placeholder="กรอกชื่อของคุณ"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">เบอร์โทรศัพท์ (ใช้ค้นหาคิวย้อนหลัง)</label>
                <input
                  type="tel"
                  placeholder="08x-xxx-xxxx"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50 text-sm"
              >
                {isSubmitting ? "กำลังบันทึก..." : "ยืนยันการรับคิว"}
              </button>
            </form>
          </div>
        ) : (
          /* หน้าแสดงสถานะคิวเมื่อลงทะเบียนแล้ว */
          <div className="space-y-6 text-center">
            <div>
              <p className="text-xs font-bold text-gray-400">คิวของคุณคือ</p>
              <h1 className="text-6xl font-black text-blue-600 mt-1 tracking-tight">{queue.queueNumber}</h1>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-xs font-bold text-amber-700">
              กรุณารอสักครู่ ระบบจะอัปเดตอัตโนมัติเมื่อถึงตัวของคุณ
            </div>

            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div>
                <p className="text-[11px] font-bold text-gray-400">คิวที่รอทั้งหมด</p>
                <p className="text-xl font-black text-gray-800 mt-0.5">{waitingCount} คิว</p>
              </div>
              <div className="border-l border-gray-200 pl-3">
                <p className="text-[11px] font-bold text-gray-400">อีกกี่คิวถึงคุณ</p>
                <p className="text-xl font-black text-blue-600 mt-0.5">{queuesAhead} คิว</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 font-medium">คิวที่กำลังเรียก</span>
                <span className="font-bold text-gray-800">
                  {queue.status === "CALLED" ? "ถึงคิวของคุณแล้ว!" : "รอเรียกคิว"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 font-medium">ประเภทบริการ</span>
                <span className="font-bold text-gray-800">
                  {queue.type === "A" && "วัดสายตา (ราคาปกติ)"}
                  {queue.type === "B" && "วัดสายตา (แคมเปญ)"}
                  {queue.type === "C" && "คิวด่วน / ติดต่อเจ้าหน้าที่"}
                  {queue.type === "D" && "คิวสำรอง"}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-left space-y-1">
              <p className="text-xs font-extrabold text-blue-800">ℹ️ ข้อมูลการรับบริการ</p>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                ระยะเวลาวัดสายตาต่อ 1 ท่านจะใช้เวลาประมาณ 15 นาที หรืออาจจะใช้เวลานานกว่านี้ (ขึ้นอยู่กับความยากง่ายของแต่ละบุคคล)
              </p>
            </div>

            {/* ข้อความแจ้งเตือน 15 นาที */}
            <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-center">
              <p className="text-[11px] font-bold text-red-600">
                * หากถึงคิวแล้วไม่แสดงตนภายใน 15 นาที ถือว่าท่านสละสิทธิ์
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}