"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, onSnapshot, collection, query, where, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function QueueStatusPage() {
  const params = useParams();
  const branchId = params.branchId as string;
  const queueId = params.queueId as string;

  const [myQueue, setMyQueue] = useState<any>(null);
  const [currentServing, setCurrentServing] = useState<string>("-");
  const [queuesAhead, setQueuesAhead] = useState<number>(0);
  const [totalWaiting, setTotalWaiting] = useState<number>(0);

  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!queueId) return;
    const queueRef = doc(db, "queues", queueId);
    
    const unsubscribeQueue = onSnapshot(queueRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMyQueue(data);

        const counterId = (data.type === "A" || data.type === "B") 
          ? `${branchId}_exam_room` 
          : `${branchId}_sales_counter`;
          
        const counterRef = doc(db, "counters", counterId);
        
        onSnapshot(counterRef, (counterSnap) => {
          if (counterSnap.exists()) {
            setCurrentServing(counterSnap.data().currentServing);
          } else {
            setCurrentServing("รอเรียกคิว");
          }
        });
      }
    });

    return () => unsubscribeQueue();
  }, [branchId, queueId]);

  useEffect(() => {
    if (!myQueue) return;

    const q = query(
      collection(db, "queues"),
      where("branchId", "==", branchId)
    );

    const unsubscribeWaiting = onSnapshot(q, (snapshot) => {
      let aheadCount = 0;
      let waitingCount = 0;
      
      const myTime = myQueue.createdAt?.toMillis() || Date.now();

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        if (data.status === "WAITING" && data.type === myQueue.type) {
          waitingCount++;
          
          const theirTime = data.createdAt?.toMillis() || 0;
          if (theirTime < myTime && docSnap.id !== queueId) {
            aheadCount++;
          }
        }
      });

      setTotalWaiting(waitingCount);
      setQueuesAhead(aheadCount);
    });

    return () => unsubscribeWaiting();
  }, [myQueue, branchId, queueId]);

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !phoneInput.trim() || phoneInput.length < 9) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้องครับ");
      return;
    }
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "queues", queueId), {
        customerName: nameInput,
        phoneNumber: phoneInput
      });
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่ครับ");
      setIsUpdating(false);
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "A": return "วัดสายตา (ราคาปกติ)";
      case "B": return "วัดสายตา (แคมเปญ)";
      case "C": return "คิวด่วน / ค่าสายตาเดิม";
      case "D": return "คิวสำรอง";
      default: return "วัดสายตา";
    }
  };

  if (!myQueue) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500 font-medium">กำลังโหลดข้อมูล...</div>;

  // กรณีลูกค้ายังไม่ได้ลงทะเบียน ชื่อ-เบอร์โทร
  if (!myQueue.customerName || !myQueue.phoneNumber) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 border-t-8 border-blue-500 text-center">
          <h2 className="text-xl font-bold text-gray-800">🎉 คุณได้คิวแล้ว!</h2>
          <p className="text-gray-500 text-sm mt-2">หมายเลขคิวของคุณคือ</p>
          <div className="text-6xl font-extrabold text-blue-600 my-4">{myQueue.queueNumber}</div>
          
          <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-sm mb-3 border border-yellow-200">
            ⚠️ <b>กรุณากรอกข้อมูลด้านล่าง</b> เพื่อยืนยันการรับคิว<br/>หากไม่กรอกข้อมูล ระบบจะไม่สามารถเรียกคิวของคุณได้
          </div>

          <p className="text-xs font-semibold text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100 mb-6">
            * หากถึงคิวแล้วไม่แสดงตนภายใน 5 นาที ถือว่าท่านสละสิทธิ์
          </p>

          <form onSubmit={handleUpdateInfo} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ - นามสกุล</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="กรอกชื่อของคุณ"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ (ใช้ค้นหาคิวภายหลัง)</label>
              <input 
                type="tel" 
                maxLength={10}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="08x-xxx-xxxx"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isUpdating}
              className={`w-full text-white font-bold text-lg py-3 rounded-lg mt-4 transition shadow-md ${isUpdating ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            >
              {isUpdating ? 'กำลังบันทึก...' : 'ยืนยันการรับคิว'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // หน้าแสดงสถานะบัตรคิวหลังลงทะเบียนแล้ว
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center border border-gray-100">
        <h1 className="text-xl font-bold text-gray-700 mb-2">คิวของคุณคือ</h1>
        
        <div className={`text-6xl font-extrabold my-6 ${myQueue.status === 'CALLED' ? 'text-green-500 animate-bounce' : 'text-blue-600'}`}>
          {myQueue.queueNumber}
        </div>

        {myQueue.status === "CALLED" && (
          <div className="bg-green-100 text-green-800 p-4 rounded-lg font-bold mb-6 text-lg animate-pulse border border-green-300">
            ถึงคิวของคุณแล้ว! กรุณาติดต่อพนักงานค่ะ/ครับ
          </div>
        )}

        {myQueue.status === "WAITING" && (
          <>
            <div className="bg-yellow-50 text-yellow-700 p-3 rounded-lg text-sm mb-4 border border-yellow-200">
              กรุณารอสักครู่ ระบบจะอัปเดตอัตโนมัติเมื่อถึงคิวของคุณ
            </div>
            
            <div className="flex justify-around bg-gray-100 rounded-lg p-4 mb-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">คิวที่รอทั้งหมด</p>
                <p className="text-xl font-bold text-gray-700">{totalWaiting} <span className="text-sm font-normal">คิว</span></p>
              </div>
              <div className="border-l border-gray-300"></div>
              <div>
                <p className="text-xs text-gray-500 mb-1">อีกกี่คิวถึงคุณ</p>
                <p className="text-xl font-bold text-blue-600">{queuesAhead} <span className="text-sm font-normal">คิว</span></p>
              </div>
            </div>
          </>
        )}

        <div className="border-t pt-6 flex justify-between items-center text-gray-600 mb-6">
          <div className="text-left">
            <p className="text-xs text-gray-500 font-semibold">คิวที่กำลังเรียก</p>
            <p className="text-2xl font-bold text-gray-800 mt-0.5">{currentServing}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-semibold">ประเภทบริการ</p>
            <p className="text-sm font-bold text-gray-800 mt-1">{getTypeName(myQueue.type)}</p>
          </div>
        </div>
        
        {(myQueue.type === 'A' || myQueue.type === 'B') && (
          <div className="mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-700 text-left">
            <span className="font-semibold block mb-1">ℹ️ ข้อมูลการรับบริการ</span>
            ระยะเวลาวัดสายตาต่อ 1 ท่านจะใช้เวลาโดยประมาณ 15 นาที หรืออาจจะใช้เวลานานกว่านี้ (ขึ้นอยู่กับความยากง่ายของแต่ละบุคคล)
          </div>
        )}

        <p className="text-sm font-semibold text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">
          * หากถึงคิวแล้วไม่แสดงตนภายใน 5 นาที<br/>ถือว่าท่านสละสิทธิ์
        </p>

      </div>
    </div>
  );
}