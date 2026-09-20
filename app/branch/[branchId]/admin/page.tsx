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
  const [showHistory, setShowHistory] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!branchId) return;

    const branchRef = doc(doc(db, "branches", branchId));
    const unsubBranch = onSnapshot(branchRef, (docSnap) => {
      if (docSnap.exists()) {
        setAllowReserve(docSnap.data().allowReserve || false);
      }
    });

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

  const toggleReserve = async () => {
    const branchRef = doc(db, "branches", branchId);
    await updateDoc(branchRef, { allowReserve: !allowReserve });
  };

  // ฟังก์ชั่นส่งเสียงเรียกคิว (TTS) รองรับระบุภาษา TH/EN แบบระบุตรง
  const speakQueue = (queueNumber: string, lang: "TH" | "EN" = "TH", isRecall = false) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel(); // ล้างคิวเสียงที่ค้างอยู่ก่อนหน้า

    let text = "";
    if (lang === "TH") {
      text = isRecall 
        ? `ขอเชิญหมายเลขคิว ${queueNumber.split("").join(" ")} อีกครั้งค่ะ` 
        : `ขอเชิญหมายเลขคิว ${queueNumber.split("").join(" ")} ที่ห้องวัดสายตาค่ะ`;
    } else {
      text = `Queue number ${queueNumber.split("").join(" ")}, please step forward to the examination room.`;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "TH" ? "th-TH" : "en-US";
    utterance.rate = 0.9;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  };

  // เรียกคิวพร้อมระบุภาษา
  const handleCallQueue = async (queue: any, lang: "TH" | "EN" = "TH", isRecall = false) => {
    try {
      await updateDoc(doc(db, "queues", queue.id), {
        status: "CALLED",
        calledAt: serverTimestamp(),
      });

      const counterId = (queue.type === "A" || queue.type === "B")
        ? `${branchId}_exam_room`
        : `${branchId}_sales_counter`;

      await updateDoc(doc(db, "counters", counterId), {
        currentServing: queue.queueNumber,
      });

      speakQueue(queue.queueNumber, lang, isRecall);
    } catch (error) {
      console.error("Error calling queue:", error);
    }
  };

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

  const handleSkipQueue = async (queueId: string) => {
    try {
      await updateDoc(doc(db, "queues", queueId), {
        status: "SKIPPED",
        skippedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error skipping queue:", error);
    }
  };

  const handleCancelQueue = async (queueId: string) => {
    if (!confirm("คุณต้องการยกเลิกคิวนี้ใช่หรือไม่?")) return;
    try {
      await updateDoc(doc(db, "queues", queueId), {
        status: "CANCELLED",
        cancelledAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error cancelling queue:", error);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
  };

  const toggleHistoryDropdown = (type: string) => {
    setShowHistory((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const filteredQueues = queues.filter((q) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      q.queueNumber?.toLowerCase().includes(term) ||
      q.customerName?.toLowerCase().includes(term) ||
      q.phoneNumber?.includes(term)
    );
  });

  const totalCount = filteredQueues.length;
  const waitingCount = filteredQueues.filter((q) => q.status === "WAITING").length;
  const calledCount = filteredQueues.filter((q) => q.status === "CALLED" || q.status === "COMPLETED").length;
  const skippedCount = filteredQueues.filter((q) => q.status === "SKIPPED").length;
  const cancelledCount = filteredQueues.filter((q) => q.status === "CANCELLED").length;

  const renderQueueSection = (type: string, title: string, colorStyle: string) => {
    const typeQueues = filteredQueues.filter((q) => q.type === type);
    const callingQueue = typeQueues.find((q) => q.status === "CALLED");
    const waitingQueues = typeQueues.filter((q) => q.status === "WAITING");
    
    const historyQueues = typeQueues
      .filter((q) => q.status === "COMPLETED" || q.status === "SKIPPED" || q.status === "CANCELLED")
      .sort((a, b) => (b.calledAt?.seconds || 0) - (a.calledAt?.seconds || 0));

    return (
      <div className={`bg-white rounded-2xl shadow-md border-t-8 ${colorStyle} p-5 flex flex-col justify-between`}>
        <div>
          <h2 className="text-lg font-extrabold text-gray-800 mb-4">{title}</h2>

          {/* คิวปัจจุบัน */}
          <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase">กำลังเรียกคิว (CURRENT)</p>
            {callingQueue ? (
              <div className="mt-2">
                <p className="text-4xl font-black text-blue-600">{callingQueue.queueNumber}</p>
                <p className="text-sm font-bold text-gray-800 mt-1">{callingQueue.customerName || "ไม่ระบุชื่อ"}</p>
                <p className="text-xs text-gray-500">{callingQueue.phoneNumber || "ไม่มีเบอร์"}</p>

                <div className="mt-2 inline-block bg-orange-50 border border-orange-100 px-3 py-1 rounded-lg">
                  <p className="text-xs font-bold text-orange-600">
                    ⏱️ เรียกเมื่อ: {formatTime(callingQueue.calledAt)}
                  </p>
                </div>

                {/* ปุ่มควบคุมคิวปัจจุบัน */}
                <div className="space-y-2 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCallQueue(callingQueue, "TH", true)}
                      className="py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition shadow-sm"
                    >
                      🇹🇭 เรียกซ้ำ (TH)
                    </button>
                    <button
                      onClick={() => handleCallQueue(callingQueue, "EN", true)}
                      className="py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-sm"
                    >
                      🇬🇧 Call (EN)
                    </button>
                  </div>

                  <button
                    onClick={() => handleCompleteQueue(callingQueue.id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm"
                  >
                    ✓ เสร็จสิ้น
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSkipQueue(callingQueue.id)}
                      className="py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold rounded-lg text-xs transition"
                    >
                      ⏭️ ข้ามคิว
                    </button>
                    <button
                      onClick={() => handleCancelQueue(callingQueue.id)}
                      className="py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg text-xs transition"
                    >
                      ❌ ยกเลิกคิว
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-300 my-4">- ว่าง -</p>
            )}
          </div>

          {/* คิวที่รออยู่ */}
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2">
              คิวที่รออยู่ ({waitingQueues.length} คิว):
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
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
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCallQueue(item, "TH")}
                        className="py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition"
                        title="เรียกคิวภาษาไทย"
                      >
                        🇹🇭 เรียก
                      </button>
                      <button
                        onClick={() => handleCallQueue(item, "EN")}
                        className="py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition"
                        title="Call English"
                      >
                        🇬🇧 EN
                      </button>
                      <button
                        onClick={() => handleCancelQueue(item.id)}
                        className="py-1 px-2 bg-red-100 hover:bg-red-200 text-red-600 font-bold rounded-lg text-xs transition"
                        title="ยกเลิกคิว"
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ประวัติคิวที่ผ่านไปแล้ว */}
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={() => toggleHistoryDropdown(type)}
              className="w-full flex items-center justify-between text-xs font-bold text-gray-500 hover:text-gray-800 transition py-1"
            >
              <span>📜 คิวที่จบ/ข้าม/ยกเลิก ({historyQueues.length})</span>
              <span>{showHistory[type] ? "▲ ปิด" : "▼ ดูรายการ"}</span>
            </button>

            {showHistory[type] && (
              <div className="space-y-2 mt-2 max-h-44 overflow-y-auto pr-1">
                {historyQueues.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-1">ยังไม่มีประวัติคิว</p>
                ) : (
                  historyQueues.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200 text-xs"
                    >
                      <div>
                        <div className="font-bold text-gray-700 flex items-center gap-1">
                          {item.queueNumber}
                          <span className="font-normal text-gray-500">({item.customerName || "ไม่ระบุ"})</span>
                          
                          {item.status === "SKIPPED" && (
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
                              ข้ามคิว
                            </span>
                          )}
                          {item.status === "CANCELLED" && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                              ยกเลิก
                            </span>
                          )}
                          {item.status === "COMPLETED" && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                              เสร็จสิ้น
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-orange-600 font-semibold mt-0.5">
                          เรียกเมื่อ: {formatTime(item.calledAt)}
                        </p>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => handleCallQueue(item, "TH", true)}
                          className="py-1 px-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-md transition text-[11px]"
                          title="ดึงกลับมาเรียกภาษาไทย"
                        >
                          🔄 TH
                        </button>
                        <button
                          onClick={() => handleCallQueue(item, "EN", true)}
                          className="py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md transition text-[11px]"
                          title="ดึงกลับมาเรียกภาษาอังกฤษ"
                        >
                          🔄 EN
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
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
            <button
              onClick={toggleReserve}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 ${
                allowReserve ? "bg-orange-500 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              คิวสำรอง (D): {allowReserve ? "🟢 เปิดรับคิว" : "🔴 ปิดรับคิว"}
            </button>
          </div>
        </div>

        {/* สรุปจำนวนคิวประจำวัน */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-bold text-gray-400">คิวทั้งหมด</p>
            <p className="text-2xl font-black text-gray-800 mt-1">{totalCount} คิว</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-bold text-amber-500">รอเรียกคิว</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{waitingCount} คิว</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-bold text-emerald-500">เรียกแล้ว/เสร็จสิ้น</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{calledCount} คิว</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-bold text-orange-500">ข้ามคิว</p>
            <p className="text-2xl font-black text-orange-600 mt-1">{skippedCount} คิว</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <p className="text-xs font-bold text-red-400">ยกเลิกคิว</p>
            <p className="text-2xl font-black text-red-500 mt-1">{cancelledCount} คิว</p>
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

        {/* การ์ดคิว A, B, C, D */}
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