
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // result is "data:mime/type;base64,..." - we want the full string for image src
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file as a Data URL.'));
        }
      };
      reader.onerror = error => reject(error);
    });
};
