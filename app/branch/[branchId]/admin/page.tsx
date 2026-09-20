"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, Timestamp, writeBatch, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminDashboardPage() {
  const params = useParams();
  const branchId = params.branchId as string;

  const [queues, setQueues] = useState<any[]>([]);
  const [allowReserve, setAllowReserve] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showHistory, setShowHistory] = useState<{ [key: string]: boolean }>({});

  // State สำหรับ Modal แก้ไขข้อมูลลูกค้า
  const [editingQueue, setEditingQueue] = useState<any | null>(null);
  const [inputName, setInputName] = useState("");
  const [inputPhone, setInputPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // State สำหรับ Modal รีเซ็ตคิวด้วยรหัสผ่าน
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!branchId) return;

    const branchRef = doc(db, "branches", branchId);
    const unsubBranch = onSnapshot(branchRef, (docSnap) => {
      if (docSnap.exists()) {
        setAllowReserve(docSnap.data().allowReserve || false);
      }
    });

    // กำหนดเวลาเริ่มต้นของวันนี้ (Today 00:00:00)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const startTimestamp = Timestamp.fromDate(todayStart);

    // ดึงเฉพาะคิวที่สร้างขึ้นตั้งแต่วันนี้เป็นต้นไป
    const q = query(
      collection(db, "queues"),
      where("branchId", "==", branchId),
      where("createdAt", ">=", startTimestamp)
    );

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
    await setDoc(branchRef, { allowReserve: !allowReserve }, { merge: true });
  };

  // ฟังก์ชั่นจัดการการรีเซ็ตคิวแบบล้างตัวเลขให้กลับเป็น 0 คิวทั้งหมด
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPassword !== "1234") {
      setResetError("รหัสผ่านไม่ถูกต้อง!");
      return;
    }

    setIsResetting(true);
    setResetError("");

    try {
      // 1. ดึงคิวทั้งหมดของวันนี้
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const startTimestamp = Timestamp.fromDate(todayStart);

      const q = query(
        collection(db, "queues"),
        where("branchId", "==", branchId),
        where("createdAt", ">=", startTimestamp)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      // 2. ลบเอกสารคิวทั้งหมดของวันนี้ออกจาก Firestore เพื่อให้ยอดสรุปทุกช่องกลายเป็น 0
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // 3. รีเซ็ตหน้าจอ Display เคาน์เตอร์หน้าร้านให้เป็น -
      const examCounterRef = doc(db, "counters", `${branchId}_exam_room`);
      const salesCounterRef = doc(db, "counters", `${branchId}_sales_counter`);
      batch.set(examCounterRef, { currentServing: "-" }, { merge: true });
      batch.set(salesCounterRef, { currentServing: "-" }, { merge: true });

      await batch.commit();

      setResetModalOpen(false);
      setResetPassword("");
      alert("รีเซ็ตและล้างข้อมูลคิวประจำวันทั้งหมดเรียบร้อยแล้ว!");
    } catch (error) {
      console.error("Error resetting queues:", error);
      alert("เกิดข้อผิดพลาดในการรีเซ็ตคิว");
    } finally {
      setIsResetting(false);
    }
  };

  // ฟังก์ชั่นส่งเสียงเรียกคิวสองภาษา
  const speakQueue = (queueNumber: string, lang: "TH" | "EN" = "TH", queueType: string = "A") => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    let text = "";
    if (lang === "TH") {
      const destination = (queueType === "A" || queueType === "B") 
        ? "ที่ห้องวัดสายตาค่ะ" 
        : "ติดต่อเจ้าหน้าที่ค่ะ";

      const numberMap: { [key: string]: string } = {
        '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
        '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า',
        'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี'
      };

      const thaiFormattedNumber = queueNumber
        .split('')
        .map(char => numberMap[char] || char)
        .join('');

      text = `ขอเชิญหมายเลข ${thaiFormattedNumber} ${destination}`;
    } else {
      const enDestination = (queueType === "A" || queueType === "B")
        ? "please step forward to the examination room."
        : "please contact our staff.";

      text = `Number ${queueNumber.split("").join(" ")}, ${enDestination}`;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "TH" ? "th-TH" : "en-US";
    utterance.rate = lang === "TH" ? 0.82 : 0.88;
    utterance.pitch = lang === "TH" ? 1.15 : 1.0;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (lang === "TH") {
        const thaiVoice = voices.find((v) => v.lang === "th-TH" || v.lang === "th_TH" || v.lang.startsWith("th"));
        if (thaiVoice) {
          utterance.voice = thaiVoice;
        }
      } else {
        const enVoice = voices.find((v) => v.lang.startsWith("en"));
        if (enVoice) {
          utterance.voice = enVoice;
        }
      }
    }

    window.speechSynthesis.speak(utterance);
  };

  const isUnregistered = (queue: any) => {
    return !queue.customerName || queue.customerName.trim() === "" || queue.customerName === "ไม่ระบุชื่อ" || queue.customerName === "รอลงทะเบียน";
  };

  const openEditModal = (queue: any) => {
    setEditingQueue(queue);
    setInputName(queue.customerName && queue.customerName !== "ไม่ระบุชื่อ" && queue.customerName !== "รอลงทะเบียน" ? queue.customerName : "");
    setInputPhone(queue.phoneNumber && queue.phoneNumber !== "ไม่มีเบอร์" ? queue.phoneNumber : "");
  };

  const handleSaveCustomerInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQueue) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(db, "queues", editingQueue.id), {
        customerName: inputName.trim() || "ไม่ระบุชื่อ",
        phoneNumber: inputPhone.trim() || "ไม่มีเบอร์",
      });
      setEditingQueue(null);
    } catch (error) {
      console.error("Error updating customer info:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCallQueue = async (queue: any, lang: "TH" | "EN" = "TH") => {
    try {
      speakQueue(queue.queueNumber, lang, queue.type);

      await updateDoc(doc(db, "queues", queue.id), {
        status: "CALLED",
        calledAt: serverTimestamp(),
      });

      const counterId = (queue.type === "A" || queue.type === "B")
        ? `${branchId}_exam_room`
        : `${branchId}_sales_counter`;

      await setDoc(doc(db, "counters", counterId), {
        currentServing: queue.queueNumber,
      }, { merge: true });

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
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {callingQueue.customerName || "ไม่ระบุชื่อ"}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {callingQueue.phoneNumber || "ไม่มีเบอร์"}
                </p>

                {isUnregistered(callingQueue) && (
                  <button
                    onClick={() => openEditModal(callingQueue)}
                    className="mb-2 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md transition border border-blue-100"
                  >
                    ✏️ เติมชื่อ/เบอร์
                  </button>
                )}

                <div className="block bg-orange-50 border border-orange-100 px-3 py-1 rounded-lg">
                  <p className="text-xs font-bold text-orange-600">
                    ⏱️ เรียกเมื่อ: {formatTime(callingQueue.calledAt)}
                  </p>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCallQueue(callingQueue, "TH")}
                      className="py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition shadow-sm active:scale-95"
                    >
                      🇹🇭 เรียกซ้ำ (TH)
                    </button>
                    <button
                      onClick={() => handleCallQueue(callingQueue, "EN")}
                      className="py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition shadow-sm active:scale-95"
                    >
                      🇬🇧 Call (EN)
                    </button>
                  </div>

                  <button
                    onClick={() => handleCompleteQueue(callingQueue.id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm active:scale-95"
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
                      <span className="text-xs text-gray-500 ml-1.5">{item.customerName || "รอลงทะเบียน"}</span>
                      
                      {isUnregistered(item) && (
                        <button
                          onClick={() => openEditModal(item)}
                          className="ml-2 text-[10px] text-blue-600 hover:underline font-semibold"
                          title="เติมข้อมูลลูกค้า"
                        >
                          ✏️ เติมชื่อ
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCallQueue(item, "TH")}
                        className="py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition active:scale-95"
                        title="เรียกคิวภาษาไทย"
                      >
                        🇹🇭 เรียก
                      </button>
                      <button
                        onClick={() => handleCallQueue(item, "EN")}
                        className="py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition active:scale-95"
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
                          
                          {isUnregistered(item) && (
                            <button
                              onClick={() => openEditModal(item)}
                              className="text-[10px] text-blue-600 hover:underline font-semibold ml-1"
                              title="เติมข้อมูลลูกค้า"
                            >
                              ✏️ เติมชื่อ
                            </button>
                          )}

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
                          onClick={() => handleCallQueue(item, "TH")}
                          className="py-1 px-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-md transition text-[11px]"
                          title="ดึงกลับมาเรียกภาษาไทย"
                        >
                          🔄 TH
                        </button>
                        <button
                          onClick={() => handleCallQueue(item, "EN")}
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

          <div className="flex items-center gap-3">
            {/* ปุ่มรีเซ็ตคิวด้วยรหัสผ่าน */}
            <button
              onClick={() => {
                setResetModalOpen(true);
                setResetPassword("");
                setResetError("");
              }}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              🔄 รีเซ็ตคิว
            </button>

            {/* ปุ่มเปิด-ปิด คิวสำรอง */}
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

      {/* ป๊อปอัป Modal สำหรับกรอกข้อมูลชื่อ + เบอร์โทรศัพท์พร้อมกัน */}
      {editingQueue && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-gray-800 text-base">
                📝 เติมข้อมูลลูกค้า (คิว {editingQueue.queueNumber})
              </h3>
              <button
                onClick={() => setEditingQueue(null)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomerInfo} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  ชื่อ - นามสกุล
                </label>
                <input
                  type="text"
                  placeholder="กรอกชื่อลูกค้า"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-800"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="tel"
                  placeholder="กรอกเบอร์โทรศัพท์ (เช่น 0812345678)"
                  value={inputPhone}
                  onChange={(e) => setInputPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-800"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingQueue(null)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? "กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ป๊อปอัป Modal ยืนยันรหัสผ่านเพื่อรีเซ็ตคิว */}
      {resetModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-extrabold text-red-600 text-base flex items-center gap-1.5">
                🔒 ยืนยันรหัสผ่านเพื่อรีเซ็ตคิว
              </h3>
              <button
                onClick={() => setResetModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              การรีเซ็ตจะทำการลบคิวทั้งหมดของวันนี้ <br />
              กรุณากรอกรหัสผ่านเพื่อยืนยันการทำรายการ
            </p>

            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  รหัสผ่านอนุมัติ
                </label>
                <input
                  type="password"
                  placeholder="กรอกรหัสผ่าน (เช่น 1234)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-extrabold tracking-widest text-gray-800"
                  autoFocus
                />
                {resetError && (
                  <p className="text-xs font-bold text-red-500 mt-1.5">{resetError}</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isResetting ? "กำลังรีเซ็ต..." : "ยืนยันรีเซ็ต"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}