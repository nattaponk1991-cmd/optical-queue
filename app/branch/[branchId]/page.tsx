"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function BranchQueueRegistration() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.branchId as string;

  const [loading, setLoading] = useState(false);
  const [allowReserve, setAllowReserve] = useState(false);

  // ดึงการตั้งค่าเปิด-ปิด คิวสำรอง D แบบ Real-time
  useEffect(() => {
    const branchRef = doc(db, "branches", branchId);
    const unsubscribe = onSnapshot(branchRef, (docSnap) => {
      if (docSnap.exists()) {
        setAllowReserve(docSnap.data().allowReserve || false);
      }
    });
    return () => unsubscribe();
  }, [branchId]);

  const handleRegisterQueue = async (type: 'A' | 'B' | 'C' | 'D') => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, "queues"),
        where("branchId", "==", branchId),
        where("type", "==", type),
        where("createdAt", ">=", today)
      );

      const querySnapshot = await getDocs(q);
      const queueCount = querySnapshot.size + 1;
      const formattedNumber = `${type}${String(queueCount).padStart(3, "0")}`;

      const docRef = await addDoc(collection(db, "queues"), {
        branchId,
        type,
        queueNumber: formattedNumber,
        status: "WAITING",
        customerName: "",
        phoneNumber: "",
        createdAt: serverTimestamp(),
      });

      router.push(`/branch/${branchId}/status/${docRef.id}`);
    } catch (error) {
      console.error("Error generating queue:", error);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">กดรับคิวบริการ</h1>
        <p className="text-sm text-center text-gray-500 mb-6">
  สาขา {branchId.replaceAll("_", " ").toUpperCase()}
</p>

        <div className="space-y-4">
          <button
            onClick={() => handleRegisterQueue('A')}
            disabled={loading}
            className="w-full p-4 bg-blue-50 border-2 border-blue-500 hover:bg-blue-100 rounded-xl text-left transition flex justify-between items-center"
          >
            <div>
              <p className="font-bold text-blue-900">🔵 คิว A: ราคาปกติ + วัดสายตาใหม่</p>
              <p className="text-xs text-blue-600 mt-1">ใช้เวลาวัดสายตาประมาณ 15 นาที</p>
            </div>
            <span className="text-xl">➔</span>
          </button>

          <button
            onClick={() => handleRegisterQueue('B')}
            disabled={loading}
            className="w-full p-4 bg-purple-50 border-2 border-purple-500 hover:bg-purple-100 rounded-xl text-left transition flex justify-between items-center"
          >
            <div>
              <p className="font-bold text-purple-900">🟣 คิว B: แคมเปญ + วัดสายตาใหม่</p>
              <p className="text-xs text-purple-600 mt-1">ใช้เวลาวัดสายตาประมาณ 15 นาที</p>
            </div>
            <span className="text-xl">➔</span>
          </button>

          <button
            onClick={() => handleRegisterQueue('C')}
            disabled={loading}
            className="w-full p-4 bg-green-50 border-2 border-green-500 hover:bg-green-100 rounded-xl text-left transition flex justify-between items-center"
          >
            <div>
              <p className="font-bold text-green-900">🟢 คิว C: ค่าสายตาเดิม / คิวด่วน</p>
              <p className="text-xs text-green-600 mt-1">ไม่ต้องรอเข้าห้องวัดสายตา</p>
            </div>
            <span className="text-xl">➔</span>
          </button>

          {/* แสดงปุ่มคิวสำรอง D เฉพาะเมื่อ Admin กดเปิดสวิตช์รับคิว */}
          {allowReserve && (
            <button
              onClick={() => handleRegisterQueue('D')}
              disabled={loading}
              className="w-full p-4 bg-orange-50 border-2 border-orange-500 hover:bg-orange-100 rounded-xl text-left transition flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-orange-900">🟠 คิว D: คิวสำรอง (Reserve)</p>
                <p className="text-xs text-orange-600 mt-1">สำหรับลูกค้าลงทะเบียนคิวสำรอง</p>
              </div>
              <span className="text-xl">➔</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}