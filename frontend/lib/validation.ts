// frontend/utils/validation.ts

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validateVietnamesePhone = (phone: string): boolean => {
  // Validates standard Vietnamese mobile prefixes (e.g., starting with 3, 5, 7, 8, or 9) and expects 9-10 digits
  return /^(0?)(3|5|7|8|9)[0-9]{8}$/.test(phone);
};

export const checkPasswordCriteria = (password: string) => {
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  
  const isValid = Object.values(criteria).every(Boolean);
  
  return { ...criteria, isValid };
};

export const formatPhoneForBackend = (phone: string): string => {
  // Removes leading zero if the user typed it, and adds the +84 prefix
  const cleanPhone = phone.startsWith("0") ? phone.substring(1) : phone;
  return `+84${cleanPhone}`;
};