"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminDashboardPage() {
  const params = useParams();
  const branchId = params.branchId as string;

  const [queues, setQueues] = useState<any[]>([]);
  const [allowReserve, setAllowReserve] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [lang, setLang] = useState<"TH" | "EN">("TH");

  // ดึงข้อมูลคิวและสถานะคิวสำรองแบบ Realtime
  useEffect(() => {
    if (!branchId) return;

    // ดึงสถานะคิวสำรอง
    const branchRef = doc(db, "branches", branchId);
    const unsubBranch = onSnapshot(branchRef, (docSnap) => {
      if (docSnap.exists()) {
        setAllowReserve(docSnap.data().allowReserve || false);
      }
    });

    // ดึงรายการคิว
    const q = query(collection(db, "queues"), where("branchId", "==", branchId));
    const unsubQueues = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap: any) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setQueues(list);
    });

    return () => {
      unsubBranch();
      unsubQueues();
    };
  }, [branchId]);

  // สวิตช์ เปิด/ปิด คิวสำรอง
  const toggleReserve = async () => {
    const branchRef = doc(db, "branches", branchId);
    await updateDoc(branchRef, { allowReserve: !allowReserve });
  };

  // ฟังก์ชั่นส่งเสียงเรียกคิว (TTS)
  const speakQueue = (queueNumber: string, isRecall = false) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    
    window.speechSynthesis.cancel(); // ยกเลิกเสียงเดิมที่ค้างอยู่

    let text = "";
    if (lang === "TH") {
      text = isRecall 
        ? `ขอเชิญหมายเลขคิว ${queueNumber.split("").join(" ")} อีกครั้งค่ะ` 
        : `ขอเชิญหมายเลขคิว ${queueNumber.split("").join(" ")} ที่ห้องวัดสายตาค่ะ`;
    } else {
      text = `Number ${queueNumber.split("").join(" ")}, please step forward.`;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "TH" ? "th-TH" : "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // ฟังก์ชั่นกดเรียกคิว (หรือเรียกซ้ำ) พร้อมลง Timestamp
  const handleCallQueue = async (queue: any, isRecall = false) => {
    try {
      await updateDoc(doc(db, "queues", queue.id), {
        status: "CALLED",
        calledAt: serverTimestamp(), // บันทึกเวลาเรียกคิว
      });

      // อัปเดตคิวที่กำลังเรียกใน Counter
      const counterId = (queue.type === "A" || queue.type === "B")
        ? `${branchId}_exam_room`
        : `${branchId}_sales_counter`;

      await updateDoc(doc(db, "counters", counterId), {
        currentServing: queue.queueNumber,
      });

      // ส่งเสียงพูด
      speakQueue(queue.queueNumber, isRecall);
    } catch (error) {
      console.error("Error calling queue:", error);
    }
  };

  // ฟังก์ชั่นกดทำรายการเสร็จสิ้น
  const handleCompleteQueue = async (queueId: string) => {
    try {
      await updateDoc(doc(db, "queues", queueId), {
        status: "COMPLETED",
        completedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error completing queue:", error);
    }
  };

  // แปลง Timestamp เป็นเวลาอ่านง่าย (เช่น 14:32 น.)
  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
  };

  // กรองค้นหาคิว
  const filteredQueues = queues.filter((q) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      q.queueNumber?.toLowerCase().includes(term) ||
      q.customerName?.toLowerCase().includes(term) ||
      q.phoneNumber?.includes(term)
    );
  });

  const renderQueueSection = (type: string, title: string, colorStyle: string) => {
    const typeQueues = filteredQueues.filter((q) => q.type === type);
    const callingQueue = typeQueues.find((q) => q.status === "CALLED");
    const waitingQueues = typeQueues.filter((q) => q.status === "WAITING");

    return (
      <div className={`bg-white rounded-2xl shadow-md border-t-8 ${colorStyle} p-5 flex flex-col justify-between`}>
        <div>
          <h2 className="text-lg font-extrabold text-gray-800 mb-4">{title}</h2>

          {/* คิวที่กำลังเรียกปัจจุบัน */}
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase">กำลังเรียกคิว (Current)</p>
            {callingQueue ? (
              <div className="mt-2">
                <p className="text-4xl font-black text-blue-600">{callingQueue.queueNumber}</p>
                <p className="text-sm font-bold text-gray-800 mt-1">{callingQueue.customerName || "ไม่ระบุชื่อ"}</p>
                <p className="text-xs text-gray-500">{callingQueue.phoneNumber || "ไม่มีเบอร์"}</p>
                
                {/* แสดง Timestamp เวลาที่ถูกเรียก */}
                {callingQueue.calledAt && (
                  <p className="text-xs font-bold text-orange-600 mt-2 bg-orange-50 py-1 px-2 rounded-md inline-block">
                    ⏱️ เรียกเมื่อ: {formatTime(callingQueue.calledAt)}
                  </p>
                )}

                <div className="flex gap-2 mt-4">
                  {/* ปุ่มเรียกซ้ำ */}
                  <button
                    onClick={() => handleCallQueue(callingQueue, true)}
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition shadow-sm"
                  >
                    📣 เรียกซ้ำ
                  </button>
                  {/* ปุ่มเสร็จสิ้น */}
                  <button
                    onClick={() => handleCompleteQueue(callingQueue.id)}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm"
                  >
                    ✓ เสร็จสิ้น
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-300 my-4">- ว่าง -</p>
            )}
          </div>

          {/* รายการคิวที่รออยู่ */}
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">
              คิวที่รออยู่ ({waitingQueues.length} คิว):
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {waitingQueues.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-2">ไม่มีคิวค้างรอ</p>
              ) : (
                waitingQueues.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100"
                  >
                    <div>
                      <span className="font-extrabold text-sm text-gray-800">{item.queueNumber}</span>
                      <span className="text-xs text-gray-500 ml-2">{item.customerName || "รอลงทะเบียน"}</span>
                    </div>
                    <button
                      onClick={() => handleCallQueue(item)}
                      className="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition"
                    >
                      เรียกคิว
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header แผงควบคุม */}
        <div className="bg-white rounded-2xl shadow-md p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-800">
              Admin Dashboard - สาขา {branchId.replaceAll("_", " ")}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* สวิตช์ เปิด/ปิด คิวสำรอง */}
            <button
              onClick={toggleReserve}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
                allowReserve ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              คิวสำรอง (D): {allowReserve ? "🟢 เปิดรับคิว" : "🔴 ปิดรับคิว"}
            </button>

            {/* เลือกภาษาเสียงเรียก */}
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setLang("TH")}
                className={`px-3 py-1.5 rounded-lg transition ${lang === "TH" ? "bg-blue-600 text-white" : "text-gray-600"}`}
              >
                🇹🇭 ภาษาไทย
              </button>
              <button
                onClick={() => setLang("EN")}
                className={`px-3 py-1.5 rounded-lg transition ${lang === "EN" ? "bg-blue-600 text-white" : "text-gray-600"}`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>
        </div>

        {/* ช่องค้นหาคิว */}
        <div className="bg-white rounded-2xl shadow-md p-4">
          <input
            type="text"
            placeholder="🔍 ค้นหาคิวด้วย: รหัสคิว (เช่น A005), ชื่อลูกค้า, หรือ เบอร์โทรศัพท์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-800"
          />
        </div>

        {/* ตารางการ์ดประเภทคิว A, B, C, D */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {renderQueueSection("A", "🔵 คิว A (ราคาปกติ)", "border-blue-500")}
          {renderQueueSection("B", "🟣 คิว B (แคมเปญ)", "border-purple-500")}
          {renderQueueSection("C", "🟢 คิว C (คิวด่วน)", "border-green-500")}
          {renderQueueSection("D", "🟠 คิว D (สำรอง)", "border-orange-500")}
        </div>
      </div>
    </div>
  );
}