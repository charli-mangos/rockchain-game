import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase"; // Ajusta la ruta según tu proyecto

export const useUserName = (userId) => {
  const [userName, setUserName] = useState(null);

  useEffect(() => {
    const fetchUserName = async () => {
      if (!userId) {
        setUserName(null);
        return;
      }
      
      // Caso especial: external miner
      if (userId === 'external_miner') {
        setUserName('External Miner');
        return;
      }
      
        try {
          const userDocRef = doc(db, "users", userId);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setUserName(userDoc.data()?.userName || "Unknown");
          } else {
            setUserName("Unknown");
          }
        } catch (error) {
          console.error(`Error fetching userName for userId: ${userId}`, error);
          setUserName("Unknown");
      }
    };

    fetchUserName();
  }, [userId]);

  return userName;
};
