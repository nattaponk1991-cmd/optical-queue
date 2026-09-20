"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SelectQueueTypePage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.branchId as string;

  const [loading, setLoading] = useState(false);
  const [allowReserve, setAllowReserve] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  // ดึงสถานะคิวสำรอง (allowReserve) จาก Firestore แบบ Realtime
  useEffect(() => {
    if (!branchId) return;
    const branchRef = doc(db, "branches", branchId);
    const unsubscribe = onSnapshot(branchRef, (docSnap) => {
      if (docSnap.exists()) {
        setAllowReserve(docSnap.data().allowReserve || false);
      }
    });
    return () => unsubscribe();
  }, [branchId]);

  // ฟังก์ชั่นสร้างคิวใหม่
  const handleSelectType = async (type: "A" | "B" | "C" | "D") => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "queues"),
        where("branchId", "==", branchId),
        where("type", "==", type)
      );
      const snapshot = await getDocs(q);
      const count = snapshot.size + 1;
      const queueNumber = `${type}${String(count).padStart(3, "0")}`;

      const docRef = await addDoc(collection(db, "queues"), {
        branchId,
        type,
        queueNumber,
        status: "WAITING",
        createdAt: serverTimestamp(),
      });

      router.push(`/branch/${branchId}/status/${docRef.id}`);
    } catch (error) {
      console.error("Error creating queue:", error);
      alert("เกิดข้อผิดพลาดในการรับคิว กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชั่นค้นหาคิวเดิมด้วยเบอร์โทรศัพท์
  const handleSearchQueue = async () => {
    if (!searchPhone.trim()) {
      setSearchError("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    setSearching(true);
    setSearchError("");

    try {
      const q = query(
        collection(db, "queues"),
        where("branchId", "==", branchId),
        where("phoneNumber", "==", searchPhone.trim())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setSearchError("ไม่พบคิวที่ตรงกับเบอร์โทรศัพท์นี้");
      } else {
        const userQueues = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const latestQueue = userQueues.sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        })[0];

        router.push(`/branch/${branchId}/status/${latestQueue.id}`);
      }
    } catch (error) {
      console.error("Error searching queue:", error);
      setSearchError("เกิดข้อผิดพลาดในการค้นหา กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 border border-gray-100">
        <h1 className="text-2xl font-extrabold text-center text-gray-800 mb-1">
          กดรับคิวมารับบริการ
        </h1>
        <p className="text-xs font-bold text-center text-gray-400 mb-6 uppercase tracking-wider">
          สาขา {branchId.replaceAll("_", " ")}
        </p>

        <div className="space-y-4">
          {/* คิว A แสดงผลตลอดเวลา */}
          <button
            onClick={() => handleSelectType("A")}
            disabled={loading}
            className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-500 rounded-2xl p-4 text-left transition flex items-center justify-between group shadow-sm disabled:opacity-50"
          >
            <div>
              <p className="font-bold text-blue-900 text-base">
                🔵 คิว A: ราคาปกติ + วัดสายตาใหม่
              </p>
              <p className="text-xs text-blue-600 mt-1 font-medium">
                ใช้เวลาวัดสายตาประมาณ 15 นาที
              </p>
            </div>
            <span className="text-blue-500 font-bold group-hover:translate-x-1 transition-transform">
              ➔
            </span>
          </button>

          {/* คิว B และ C แสดงผลเฉพาะเมื่อไม่ได้เปิดคิวสำรอง (!allowReserve) */}
          {!allowReserve && (
            <>
              <button
                onClick={() => handleSelectType("B")}
                disabled={loading}
                className="w-full bg-purple-50 hover:bg-purple-100 border-2 border-purple-500 rounded-2xl p-4 text-left transition flex items-center justify-between group shadow-sm disabled:opacity-50"
              >
                <div>
                  <p className="font-bold text-purple-900 text-base">
                    🟣 คิว B: แคมเปญ + วัดสายตาใหม่
                  </p>
                  <p className="text-xs text-purple-600 mt-1 font-medium">
                    ใช้เวลาวัดสายตาประมาณ 15 นาที
                  </p>
                </div>
                <span className="text-purple-500 font-bold group-hover:translate-x-1 transition-transform">
                  ➔
                </span>
              </button>

              <button
                onClick={() => handleSelectType("C")}
                disabled={loading}
                className="w-full bg-green-50 hover:bg-green-100 border-2 border-green-500 rounded-2xl p-4 text-left transition flex items-center justify-between group shadow-sm disabled:opacity-50"
              >
                <div>
                  <p className="font-bold text-green-900 text-base">
                    🟢 คิว C: ค่าสายตาเดิม / คิวด่วน
                  </p>
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    ไม่ต้องรอเข้าห้องวัดสายตา
                  </p>
                </div>
                <span className="text-green-500 font-bold group-hover:translate-x-1 transition-transform">
                  ➔
                </span>
              </button>
            </>
          )}

          {/* คิว D แสดงผลเฉพาะเมื่อเปิดคิวสำรอง (allowReserve) */}
          {allowReserve && (
            <button
              onClick={() => handleSelectType("D")}
              disabled={loading}
              className="w-full bg-orange-50 hover:bg-orange-100 border-2 border-orange-500 rounded-2xl p-4 text-left transition flex items-center justify-between group shadow-sm disabled:opacity-50"
            >
              <div>
                <p className="font-bold text-orange-900 text-base">
                  🟠 คิว D: คิวสำรอง
                </p>
                <p className="text-xs text-orange-600 mt-1 font-medium">
                  ติดต่อเจ้าหน้าที่เพื่อยืนยันสิทธิ์
                </p>
              </div>
              <span className="text-orange-500 font-bold group-hover:translate-x-1 transition-transform">
                ➔
              </span>
            </button>
          )}
        </div>

        {/* ปุ่มค้นหาคิวเดิม */}
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500 mb-2">มีคิวอยู่แล้วหรือเผลอปิดหน้าจอ?</p>
          <button
            onClick={() => setSearchModalOpen(true)}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            🔍 ตรวจสอบสถานะคิวเดิม
          </button>
        </div>
      </div>

      {/* Modal ค้นหาคิวเดิมด้วยเบอร์โทรศัพท์ */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              ค้นหาบัตรคิวเดิม
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              กรอกเบอร์โทรศัพท์ที่เคยลงทะเบียนไว้เพื่อเปิดบัตรคิว
            </p>

            <div className="space-y-3">
              <input
                type="tel"
                placeholder="เช่น 0812345678"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-semibold text-gray-900 bg-gray-50 placeholder-gray-400"
              />

              {searchError && (
                <p className="text-xs font-bold text-red-500">{searchError}</p>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setSearchModalOpen(false);
                  setSearchError("");
                  setSearchPhone("");
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSearchQueue}
                disabled={searching}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-md disabled:bg-gray-300"
              >
                {searching ? "กำลังค้นหา..." : "ค้นหาคิว"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}