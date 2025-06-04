import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export const useProductDetails = (productId, gameId) => {
  const [productDetails, setProductDetails] = useState(null);

  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!productId || !gameId) return;

      try {
        // Obtener el ID base del producto (antes del guión)
        const baseProductId = productId.split('-')[0];
        
        // Buscar el producto en la colección de productos
        const productRef = doc(db, 'products', baseProductId);
        const productDoc = await getDoc(productRef);
        
        if (productDoc.exists()) {
          const productData = productDoc.data();
          setProductDetails({
            description: productData.description,
            type: productData.type,
            marbleType: productData.marbleType
          });
        }
      } catch (error) {
        console.error('Error fetching product details:', error);
      }
    };

    fetchProductDetails();
  }, [productId, gameId]);

  return productDetails;
}; 