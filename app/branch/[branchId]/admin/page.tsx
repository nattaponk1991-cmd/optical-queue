"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminDashboardPage() {
  const params = useParams();
  const branchId = params.branchId as string;

  const [queuesA, setQueuesA] = useState<any[]>([]);
  const [queuesB, setQueuesB] = useState<any[]>([]); 
  const [queuesC, setQueuesC] = useState<any[]>([]); 
  const [queuesD, setQueuesD] = useState<any[]>([]); 
  
  const [currentA, setCurrentA] = useState<any>(null);
  const [currentB, setCurrentB] = useState<any>(null);
  const [currentC, setCurrentC] = useState<any>(null);
  const [currentD, setCurrentD] = useState<any>(null);

  // State สรุปสถิติคิวประจำวัน
  const [stats, setStats] = useState({
    totalA: 0, calledA: 0,
    totalB: 0, calledB: 0,
    totalC: 0, calledC: 0,
    totalD: 0, calledD: 0,
    totalAll: 0, calledAll: 0
  });

  // State สำหรับค้นหาคิว และเก็บรายการคิวทั้งหมดของวันนี้
  const [searchQuery, setSearchQuery] = useState("");
  const [allTodayQueues, setAllTodayQueues] = useState<any[]>([]);

  const [defaultLang, setDefaultLang] = useState<'th' | 'en'>('th');
  const [allowReserve, setAllowReserve] = useState<boolean>(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<any>(null);
  const [inputName, setInputName] = useState("");
  const [inputPhone, setInputPhone] = useState("");

  useEffect(() => {
    const branchRef = doc(db, "branches", branchId);
    const unsubscribe = onSnapshot(branchRef, (docSnap) => {
      if (docSnap.exists()) {
        setAllowReserve(docSnap.data().allowReserve || false);
      }
    });
    return () => unsubscribe();
  }, [branchId]);

  const toggleReserveStatus = async () => {
    try {
      const branchRef = doc(db, "branches", branchId);
      await setDoc(branchRef, { allowReserve: !allowReserve }, { merge: true });
    } catch (error) {
      console.error("Error updating reserve status:", error);
    }
  };

  const speakQueue = (queueNumber: string, locationNameTH: string, locationNameEN: string, lang: 'th' | 'en' = 'th') => {
    if (typeof window === "undefined") return;

    const formattedNumber = queueNumber.split("").join(" ");

    if (lang === 'th') {
      const text = `ขอเชิญคิวหมายเลข ${formattedNumber} ${locationNameTH}ค่ะ`;
      const audioUrl = `/api/tts?text=${encodeURIComponent(text)}`;
      
      const audio = new Audio(audioUrl);
      audio.play().catch((err) => console.error("Audio playback error:", err));
    } else {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const text = `Number ${formattedNumber}, please ${locationNameEN}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, "queues"),
      where("branchId", "==", branchId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const waitingA: any[] = [];
      const waitingB: any[] = [];
      const waitingC: any[] = [];
      const waitingD: any[] = [];
      
      let activeA = null;
      let activeB = null;
      let activeC = null;
      let activeD = null;

      let countTotalA = 0, countCalledA = 0;
      let countTotalB = 0, countCalledB = 0;
      let countTotalC = 0, countCalledC = 0;
      let countTotalD = 0, countCalledD = 0;

      const todayList: any[] = [];
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

snapshot.forEach((docSnap: any) => {
  const data: any = { id: docSnap.id, ...docSnap.data() };
        const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();

        if (createdAt >= startOfToday) {
          todayList.push(data);

          if (data.type === "A") {
            countTotalA++;
            if (data.status === "CALLED") { activeA = data; countCalledA++; }
            else if (data.status === "COMPLETED") { countCalledA++; }
            else if (data.status === "WAITING") waitingA.push(data);
          } else if (data.type === "B") {
            countTotalB++;
            if (data.status === "CALLED") { activeB = data; countCalledB++; }
            else if (data.status === "COMPLETED") { countCalledB++; }
            else if (data.status === "WAITING") waitingB.push(data);
          } else if (data.type === "C") {
            countTotalC++;
            if (data.status === "CALLED") { activeC = data; countCalledC++; }
            else if (data.status === "COMPLETED") { countCalledC++; }
            else if (data.status === "WAITING") waitingC.push(data);
          } else if (data.type === "D") {
            countTotalD++;
            if (data.status === "CALLED") { activeD = data; countCalledD++; }
            else if (data.status === "COMPLETED") { countCalledD++; }
            else if (data.status === "WAITING") waitingD.push(data);
          }
        }
      });

      setQueuesA(waitingA);
      setQueuesB(waitingB);
      setQueuesC(waitingC);
      setQueuesD(waitingD);
      
      setCurrentA(activeA);
      setCurrentB(activeB);
      setCurrentC(activeC);
      setCurrentD(activeD);

      setAllTodayQueues(todayList);

      setStats({
        totalA: countTotalA, calledA: countCalledA,
        totalB: countTotalB, calledB: countCalledB,
        totalC: countTotalC, calledC: countCalledC,
        totalD: countTotalD, calledD: countCalledD,
        totalAll: countTotalA + countTotalB + countTotalC + countTotalD,
        calledAll: countCalledA + countCalledB + countCalledC + countCalledD,
      });
    });

    return () => unsubscribe();
  }, [branchId]);

  const getLocationNames = (type: 'A' | 'B' | 'C' | 'D') => {
    if (type === 'A' || type === 'B') {
      return { th: "ที่ห้องวัดสายตา", en: "go to Eye Examination Room" };
    }
    return { th: "ติดต่อเจ้าหน้าที่", en: "contact staff" };
  };

  const callNextQueue = async (type: 'A' | 'B' | 'C' | 'D') => {
    let list = [];
    if (type === 'A') list = queuesA;
    if (type === 'B') list = queuesB;
    if (type === 'C') list = queuesC;
    if (type === 'D') list = queuesD;

    if (list.length === 0) {
      alert("ไม่มีคิวรอในระบบครับ");
      return;
    }

    const nextQueue = list[0]; 
    const counterId = `${branchId}_counter`;
    const locations = getLocationNames(type);

    try {
      await updateDoc(doc(db, "queues", nextQueue.id), { status: "CALLED" });
      await setDoc(doc(db, "counters", counterId), { 
        currentServing: nextQueue.queueNumber 
      }, { merge: true });

      speakQueue(nextQueue.queueNumber, locations.th, locations.en, defaultLang);

    } catch (error) {
      console.error("Error calling next queue:", error);
      alert("เกิดข้อผิดพลาดในการเรียกคิว");
    }
  };

  const recallQueue = (queueNumber: string, type: 'A' | 'B' | 'C' | 'D', lang: 'th' | 'en') => {
    const locations = getLocationNames(type);
    speakQueue(queueNumber, locations.th, locations.en, lang);
  };

  const completeQueue = async (queueId: string) => {
    try {
      await updateDoc(doc(db, "queues", queueId), { status: "COMPLETED" });
    } catch (error) {
      console.error("Error completing queue:", error);
    }
  };

  const handleOpenEditModal = (queue: any) => {
    setSelectedQueue(queue);
    setInputName(queue.customerName || "");
    setInputPhone(queue.phoneNumber || "");
    setEditModalOpen(true);
  };

  const handleSaveCustomerInfo = async () => {
    if (!selectedQueue) return;

    try {
      await updateDoc(doc(db, "queues", selectedQueue.id), {
        customerName: inputName,
        phoneNumber: inputPhone,
      });
      setEditModalOpen(false);
      setSelectedQueue(null);
    } catch (error) {
      console.error("Error updating customer info:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  // กรองคิวตามคำค้นหา (รหัสคิว, ชื่อ, เบอร์โทร)
  const filteredSearchResults = searchQuery.trim() === "" 
    ? [] 
    : allTodayQueues.filter((q) => {
        const queryClean = searchQuery.toLowerCase().trim();
        const matchNumber = q.queueNumber?.toLowerCase().includes(queryClean);
        const matchName = q.customerName?.toLowerCase().includes(queryClean);
        const matchPhone = q.phoneNumber?.includes(queryClean);
        return matchNumber || matchName || matchPhone;
      });

  const renderQueueCard = (
    title: string, 
    type: 'A' | 'B' | 'C' | 'D', 
    borderColor: string, 
    bgColor: string, 
    textColor: string, 
    current: any, 
    queues: any[]
  ) => (
    <div className={`bg-white rounded-2xl shadow-lg p-6 border-t-8 ${borderColor} flex flex-col h-full`}>
      <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
      
      <div className={`${bgColor} rounded-xl p-4 mb-4 text-center border border-gray-100`}>
        <p className="text-gray-500 text-xs font-semibold mb-1">กำลังเรียกคิว (Current)</p>
        <div className={`text-4xl font-extrabold ${textColor} mb-2`}>
          {current ? current.queueNumber : "-"}
        </div>
        <div className="bg-white rounded-lg p-2 border border-gray-100 shadow-sm inline-block min-w-[80%] relative">
          <p className="text-gray-700 text-sm font-bold">
            {current ? current.customerName || "ยังไม่ระบุชื่อ" : "ว่าง"}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            📞 {current?.phoneNumber || "ไม่มีเบอร์"}
          </p>
          {current && (!current.customerName || !current.phoneNumber) && (
            <button
              onClick={() => handleOpenEditModal(current)}
              className="mt-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-1 px-2 rounded-md transition"
            >
              ✏️ เพิ่มข้อมูลลูกค้า
            </button>
          )}
        </div>
        
        {current && (
          <div className="space-y-2 mt-4">
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => recallQueue(current.queueNumber, type, 'th')}
                className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
              >
                🔊 เรียก (ไทย)
              </button>
              <button 
                onClick={() => recallQueue(current.queueNumber, type, 'en')}
                className="bg-amber-600 hover:bg-amber-700 text-white p-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
              >
                🔊 Call (EN)
              </button>
            </div>
            <button 
              onClick={() => completeQueue(current.id)}
              className="w-full bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg text-sm font-semibold transition"
            >
              ✅ เสร็จสิ้น
            </button>
          </div>
        )}
      </div>

      <button 
        onClick={() => callNextQueue(type)}
        disabled={!!current || queues.length === 0}
        className={`w-full py-3 rounded-xl font-bold mb-4 transition shadow-md 
          ${!!current || queues.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
      >
        เรียกคิว (รอ {queues.length} คิว)
      </button>

      <div className="flex-grow overflow-y-auto pr-2">
        <p className="text-sm font-semibold text-gray-500 mb-2">คิวที่รออยู่:</p>
        <div className="space-y-3">
          {queues.map((q, index) => (
            <div key={q.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex flex-col">
                <div className="flex items-baseline">
                  <span className={`font-bold ${textColor} text-base mr-2 w-10`}>{q.queueNumber}</span>
                  <span className="text-gray-700 text-sm font-bold">{q.customerName || "ยังไม่ระบุชื่อ"}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1 pl-12 flex items-center gap-2">
                  <span>📞 {q.phoneNumber || "ไม่มีเบอร์"}</span>
                  {(!q.customerName || !q.phoneNumber) && (
                    <button
                      onClick={() => handleOpenEditModal(q)}
                      className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-1.5 py-0.5 rounded transition"
                    >
                      ✏️ ใส่ข้อมูล
                    </button>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full font-medium whitespace-nowrap">คิวที่ {index + 1}</span>
            </div>
          ))}
          {queues.length === 0 && <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">ไม่มีลูกค้ารอ</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
         <h1 className="text-3xl font-bold text-gray-800">
  Admin Dashboard - สาขา {branchId.replaceAll("_", " ").toUpperCase()}
</h1>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
              <span className="text-xs font-bold text-gray-700 ml-1">🟠 คิวสำรอง (D):</span>
              <button 
                onClick={toggleReserveStatus}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  allowReserve ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}
              >
                {allowReserve ? '🟢 เปิดรับคิว' : '🔴 ปิดรับคิว'}
              </button>
            </div>

            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 ml-2">ภาษาเสียงหลัก:</span>
              <button 
                onClick={() => setDefaultLang('th')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${defaultLang === 'th' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                🇹🇭 ภาษาไทย
              </button>
              <button 
                onClick={() => setDefaultLang('en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${defaultLang === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>
        </div>

        {/* ---- แผงค้นหาคิวลูกค้า ---- */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-200">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              🔍
            </div>
            <input
              type="text"
              placeholder="ค้นหาคิวด้วย: รหัสคิว (เช่น A005), ชื่อลูกค้า, หรือ เบอร์โทรศัพท์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-gray-900 bg-gray-50 placeholder-gray-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-gray-400 hover:text-gray-600"
              >
                ✖ ล้าง
              </button>
            )}
          </div>

          {/* แสดงผลลัพธ์การค้นหา */}
          {searchQuery.trim() !== "" && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-500 mb-2">
                ผลการค้นหา ({filteredSearchResults.length} รายการ):
              </p>
              
              {filteredSearchResults.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">ไม่พบคิวที่ตรงกับคำค้นหา "{searchQuery}"</p>
              ) : (
                <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {filteredSearchResults.map((q) => (
                    <div key={q.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-50 px-2 rounded-lg transition">
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-blue-600 text-lg min-w-[50px]">{q.queueNumber}</span>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{q.customerName || "ยังไม่ระบุชื่อ"}</p>
                          <p className="text-xs text-gray-500">📞 {q.phoneNumber || "ไม่มีเบอร์"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          q.status === 'WAITING' ? 'bg-yellow-100 text-yellow-800' :
                          q.status === 'CALLED' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {q.status === 'WAITING' ? '⏳ รอเรียก' : q.status === 'CALLED' ? '🔊 กำลังเรียก' : '✅ เสร็จสิ้น'}
                        </span>

                        {q.status === 'CALLED' && (
                          <button
                            onClick={() => recallQueue(q.queueNumber, q.type, defaultLang)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition"
                          >
                            🔊 เรียกซ้ำ
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEditModal(q)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold px-2 py-1 rounded-lg transition"
                        >
                          ✏️ แก้ไขข้อมูล
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- แผงสรุปสถิติคิวประจำวัน ---- */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-200">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            📊 สรุปภาพรวมคิววันนี้ 
            <span className="text-xs font-normal text-gray-500">(รวมทั้งหมด {stats.totalAll} คิว | เรียกแล้ว {stats.calledAll} คิว)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
              <p className="text-xs font-bold text-blue-800 mb-1">🔵 คิว A (ปกติ)</p>
              <p className="text-lg font-black text-blue-600">{stats.calledA} <span className="text-xs text-gray-500 font-normal">/ {stats.totalA}</span></p>
              <p className="text-[10px] text-blue-600 font-semibold mt-0.5">เรียกแล้ว {stats.calledA} คิว (รอ {queuesA.length})</p>
            </div>

            <div className="bg-purple-50 border border-purple-100 p-3 rounded-xl">
              <p className="text-xs font-bold text-purple-800 mb-1">🟣 คิว B (แคมเปญ)</p>
              <p className="text-lg font-black text-purple-600">{stats.calledB} <span className="text-xs text-gray-500 font-normal">/ {stats.totalB}</span></p>
              <p className="text-[10px] text-purple-600 font-semibold mt-0.5">เรียกแล้ว {stats.calledB} คิว (รอ {queuesB.length})</p>
            </div>

            <div className="bg-green-50 border border-green-100 p-3 rounded-xl">
              <p className="text-xs font-bold text-green-800 mb-1">🟢 คิว C (คิวด่วน)</p>
              <p className="text-lg font-black text-green-600">{stats.calledC} <span className="text-xs text-gray-500 font-normal">/ {stats.totalC}</span></p>
              <p className="text-[10px] text-green-600 font-semibold mt-0.5">เรียกแล้ว {stats.calledC} คิว (รอ {queuesC.length})</p>
            </div>

            <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl">
              <p className="text-xs font-bold text-orange-800 mb-1">🟠 คิว D (สำรอง)</p>
              <p className="text-lg font-black text-orange-600">{stats.calledD} <span className="text-xs text-gray-500 font-normal">/ {stats.totalD}</span></p>
              <p className="text-[10px] text-orange-600 font-semibold mt-0.5">เรียกแล้ว {stats.calledD} คิว (รอ {queuesD.length})</p>
            </div>

          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {renderQueueCard("🔵 คิว A (ราคาปกติ)", "A", "border-blue-500", "bg-blue-50", "text-blue-600", currentA, queuesA)}
          {renderQueueCard("🟣 คิว B (แคมเปญ)", "B", "border-purple-500", "bg-purple-50", "text-purple-600", currentB, queuesB)}
          {renderQueueCard("🟢 คิว C (คิวด่วน)", "C", "border-green-500", "bg-green-50", "text-green-600", currentC, queuesC)}
          {renderQueueCard("🟠 คิว D (สำรอง)", "D", "border-orange-500", "bg-orange-50", "text-orange-600", currentD, queuesD)}
        </div>
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              เพิ่มข้อมูลลูกค้า (คิว {selectedQueue?.queueNumber})
            </h3>
            <p className="text-xs text-gray-500 mb-4">ระบุชื่อและเบอร์โทรศัพท์ของลูกค้า</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ชื่อลูกค้า</label>
                <input
                  type="text"
                  placeholder="เช่น คุณสมชาย"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-gray-900 bg-white placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  placeholder="เช่น 0812345678"
                  value={inputPhone}
                  onChange={(e) => setInputPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-gray-900 bg-white placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveCustomerInfo}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-md"
              >
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}