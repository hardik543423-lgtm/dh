import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Reusable Input Field Component
const InputField = ({ label, type, name, placeholder, value, onChange, error, required = false, maxLength, pattern }) => (
  <div className="flex-1 min-w-0">
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      pattern={pattern}
      className={`w-full p-4 rounded-2xl bg-white/5 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 border ${
        error ? 'border-red-500' : 'border-white/10'
      } focus:border-indigo-500 outline-none backdrop-blur-sm`}
    />
    {error && <p className="text-red-400 text-[10px] mt-1 uppercase font-bold tracking-tighter ml-1">{error}</p>}
  </div>
);

// File Upload Component
const FileUploadField = ({ label, name, onChange, error, required = false, preview }) => (
  <div className="flex-1 min-w-0">
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
      {label} {required && <span className="text-red-500">*</span>}
      <span className="text-[10px] text-slate-600 ml-2">(Max 5MB)</span>
    </label>
    <div className="relative group">
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/jpg"
        onChange={onChange}
        className="hidden"
        id={`file-${name}`}
      />
      <label
        htmlFor={`file-${name}`}
        className={`flex items-center justify-center w-full p-5 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
          error ? 'border-red-500 bg-red-500/5' : 'border-white/10 bg-white/5 hover:border-indigo-500/50 hover:bg-indigo-500/5'
        }`}
      >
        {preview ? (
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={preview} alt="Preview" className="w-10 h-10 object-cover rounded-lg shadow-lg" />
              <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                <i className="fas fa-check text-[10px] text-white"></i>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-tight">File Ready</span>
          </div>
        ) : (
          <div className="text-center group-hover:scale-105 transition-transform duration-300">
            <i className="fas fa-cloud-upload-alt text-xl text-slate-600 mb-2 group-hover:text-indigo-400"></i>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Click to upload</p>
          </div>
        )}
      </label>
    </div>
    {error && <p className="text-red-400 text-[10px] mt-1 uppercase font-bold tracking-tighter ml-1">{error}</p>}
  </div>
);

const RegistrationForm = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    mobileNumber: '',
    whatsappNumber: '',
    email: '',
    nameAsPerAadhaar: '',
    aadhaarNumber: '',
    panNumber: '',
    permanentAddress: '',
  });

  const [files, setFiles] = useState({
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null,
    passportPhoto: null,
  });

  const [previews, setPreviews] = useState({
    aadhaarFront: null,
    aadhaarBack: null,
    panCard: null,
    passportPhoto: null,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ text: '', type: '' });

  // Validation rules
  const validate = () => {
    const newErrors = {};

    // Personal Info
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    
    // Mobile validation (10 digits, starts with 6-9)
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!formData.mobileNumber) newErrors.mobileNumber = 'Mobile number is required';
    else if (!mobileRegex.test(formData.mobileNumber)) newErrors.mobileNumber = 'Invalid mobile number (10 digits, starts with 6-9)';
    
    if (!formData.whatsappNumber) newErrors.whatsappNumber = 'WhatsApp number is required';
    else if (!mobileRegex.test(formData.whatsappNumber)) newErrors.whatsappNumber = 'Invalid WhatsApp number (10 digits, starts with 6-9)';

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!emailRegex.test(formData.email)) newErrors.email = 'Invalid email format';

    // KYC validation
    if (!formData.nameAsPerAadhaar.trim()) newErrors.nameAsPerAadhaar = 'Name as per Aadhaar is required';
    
    // Aadhaar validation (12 digits)
    const aadhaarRegex = /^\d{12}$/;
    if (!formData.aadhaarNumber) newErrors.aadhaarNumber = 'Aadhaar number is required';
    else if (!aadhaarRegex.test(formData.aadhaarNumber)) newErrors.aadhaarNumber = 'Aadhaar must be 12 digits';

    // PAN validation (ABCDE1234F format)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!formData.panNumber) newErrors.panNumber = 'PAN number is required';
    else if (!panRegex.test(formData.panNumber.toUpperCase())) newErrors.panNumber = 'Invalid PAN format (e.g., ABCDE1234F)';

    // Address validation
    if (!formData.permanentAddress.trim()) newErrors.permanentAddress = 'Permanent address is required';

    // Document validation (Aadhaar and PAN are mandatory)
    if (!files.aadhaarFront) newErrors.aadhaarFront = 'Aadhaar front image is required';
    if (!files.aadhaarBack) newErrors.aadhaarBack = 'Aadhaar back image is required';
    if (!files.panCard) newErrors.panCard = 'PAN card image is required';
    // Passport photo is optional

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-uppercase PAN number
    const processedValue = name === 'panNumber' ? value.toUpperCase() : value;
    
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    setSubmitMessage({ text: '', type: '' });
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    const file = fileList[0];

    if (!file) return;

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      setErrors((prev) => ({ ...prev, [name]: 'File size must be less than 5MB' }));
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [name]: 'Only JPG/PNG images are allowed' }));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviews((prev) => ({ ...prev, [name]: reader.result }));
    };
    reader.readAsDataURL(file);

    setFiles((prev) => ({ ...prev, [name]: file }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validate();
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      setSubmitMessage({ text: 'Please fix the errors above', type: 'error' });
      // Scroll to top to show errors
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage({ text: '', type: '' });

    try {
      // Create FormData for multipart upload
      const submitData = new FormData();
      
      // Append text fields
      Object.keys(formData).forEach(key => {
        submitData.append(key, formData[key]);
      });

      // Append files
      if (files.aadhaarFront) submitData.append('aadhaarFront', files.aadhaarFront);
      if (files.aadhaarBack) submitData.append('aadhaarBack', files.aadhaarBack);
      if (files.panCard) submitData.append('panCard', files.panCard);
      if (files.passportPhoto) submitData.append('passportPhoto', files.passportPhoto);

      const apiUrl = import.meta.env.VITE_REACT_APP_API_URL || '';
      
      const response = await fetch(`${apiUrl}/api/registration/submit`, {
        method: 'POST',
        body: submitData, // FormData automatically sets correct Content-Type
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitMessage({ 
          text: '✅ Registration submitted successfully! We will review your application and contact you soon.', 
          type: 'success' 
        });
        
        // Clear form after success
        setFormData({
          firstName: '',
          middleName: '',
          lastName: '',
          mobileNumber: '',
          whatsappNumber: '',
          email: '',
          nameAsPerAadhaar: '',
          aadhaarNumber: '',
          panNumber: '',
          permanentAddress: '',
        });
        setFiles({
          aadhaarFront: null,
          aadhaarBack: null,
          panCard: null,
          passportPhoto: null,
        });
        setPreviews({
          aadhaarFront: null,
          aadhaarBack: null,
          panCard: null,
          passportPhoto: null,
        });

        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        throw new Error(result.message || 'Registration failed');
      }

    } catch (err) {
      setSubmitMessage({ 
        text: err.message || 'Registration failed. Please try again.', 
        type: 'error' 
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06080f] py-12 px-4 relative overflow-hidden font-['Inter']">
      {/* Background Ambient Orbs */}
      <div className="absolute top-[-5%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        crossOrigin="anonymous"
      />
      
      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-10 relative">
          <div className="sm:absolute left-0 top-1/2 sm:-translate-y-1/2 flex flex-col sm:items-start items-center gap-3 mb-4 sm:mb-0">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-slate-500 hover:text-indigo-400 transition-colors"
            >
              <i className="fas fa-home mr-2 text-xs"></i>
              <span className="text-xs font-bold uppercase tracking-wider">Back to Home</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <i className="fas fa-arrow-left mr-2 text-xs"></i>
              <span className="text-xs font-bold uppercase tracking-wider">Back to Login</span>
            </button>
          </div>
          
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600/20 rounded-xl mb-4">
            <i className="fas fa-user-plus text-indigo-400 text-xl"></i>
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Create Account</h1>
          <p className="text-slate-400">Join our trading network as a partner</p>
        </div>

        {/* Form Card */}
        <div 
          className="bg-slate-900/60 backdrop-blur-2xl rounded-[2rem] shadow-2xl p-6 sm:p-10 border border-white/10"
        >
          {/* Submit Message */}
          {submitMessage.text && (
            <div
              className={`p-4 mb-8 rounded-2xl font-semibold text-sm text-center border animate-in fade-in zoom-in duration-300 ${
                submitMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}
            >
              {submitMessage.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* ===== PERSONAL INFO SECTION ===== */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <i className="fas fa-user text-indigo-400 text-xs"></i>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">Personal Information</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <InputField
                  label="First Name"
                  type="text"
                  name="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={errors.firstName}
                  required
                />
                <InputField
                  label="Middle Name"
                  type="text"
                  name="middleName"
                  placeholder="Optional"
                  value={formData.middleName}
                  onChange={handleChange}
                  error={errors.middleName}
                />
                <InputField
                  label="Last Name"
                  type="text"
                  name="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={errors.lastName}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
                <InputField
                  label="Mobile Number"
                  type="tel"
                  name="mobileNumber"
                  placeholder="9876543210"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  error={errors.mobileNumber}
                  required
                  maxLength={10}
                />
                <InputField
                  label="WhatsApp Number"
                  type="tel"
                  name="whatsappNumber"
                  placeholder="9876543210"
                  value={formData.whatsappNumber}
                  onChange={handleChange}
                  error={errors.whatsappNumber}
                  required
                  maxLength={10}
                />
              </div>

              <div className="mt-5">
                <InputField
                  label="Email Address"
                  type="email"
                  name="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  required
                />
              </div>
            </section>

            {/* ===== KYC DETAILS SECTION ===== */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <i className="fas fa-id-card text-indigo-400 text-xs"></i>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">KYC Details</h2>
              </div>

              <InputField
                label="Name (as per Aadhaar)"
                type="text"
                name="nameAsPerAadhaar"
                placeholder="Full name as printed on card"
                value={formData.nameAsPerAadhaar}
                onChange={handleChange}
                error={errors.nameAsPerAadhaar}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
                <InputField
                  label="Aadhaar Card Number"
                  type="text"
                  name="aadhaarNumber"
                  placeholder="12-digit number"
                  value={formData.aadhaarNumber}
                  onChange={handleChange}
                  error={errors.aadhaarNumber}
                  required
                  maxLength={12}
                />
                <InputField
                  label="PAN Card Number"
                  type="text"
                  name="panNumber"
                  placeholder="ABCDE1234F"
                  value={formData.panNumber}
                  onChange={handleChange}
                  error={errors.panNumber}
                  required
                  maxLength={10}
                />
              </div>
            </section>

            {/* ===== ADDRESS SECTION ===== */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <i className="fas fa-map-marker-alt text-indigo-400 text-xs"></i>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">Address Details</h2>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Permanent Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="permanentAddress"
                  placeholder="Complete address as per Aadhaar"
                  value={formData.permanentAddress}
                  onChange={handleChange}
                  rows={3}
                  className={`w-full p-4 rounded-2xl bg-white/5 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500/50 transition-all duration-300 border ${
                    errors.permanentAddress ? 'border-red-500' : 'border-white/10'
                  } focus:border-indigo-500 outline-none resize-none backdrop-blur-sm`}
                />
                {errors.permanentAddress && <p className="text-red-400 text-[10px] mt-1 uppercase font-bold tracking-tighter ml-1">{errors.permanentAddress}</p>}
              </div>
            </section>

            {/* ===== DOCUMENTS SECTION ===== */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <i className="fas fa-file-upload text-indigo-400 text-xs"></i>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight">Document Upload</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FileUploadField
                  label="Aadhaar Front"
                  name="aadhaarFront"
                  onChange={handleFileChange}
                  error={errors.aadhaarFront}
                  required
                  preview={previews.aadhaarFront}
                />
                <FileUploadField
                  label="Aadhaar Back"
                  name="aadhaarBack"
                  onChange={handleFileChange}
                  error={errors.aadhaarBack}
                  required
                  preview={previews.aadhaarBack}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
                <FileUploadField
                  label="PAN Card Front"
                  name="panCard"
                  onChange={handleFileChange}
                  error={errors.panCard}
                  required
                  preview={previews.panCard}
                />
                <FileUploadField
                  label="Passport Photo"
                  name="passportPhoto"
                  onChange={handleFileChange}
                  error={errors.passportPhoto}
                  preview={previews.passportPhoto}
                />
              </div>
            </section>

            {/* ===== SUBMIT BUTTON ===== */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-5 rounded-2xl text-lg font-black text-white uppercase bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 transition-all duration-300 shadow-xl shadow-indigo-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin"></i>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Application</span>
                    <i className="fas fa-paper-plane text-sm opacity-70"></i>
                  </>
                )}
              </button>

              <p className="text-center mt-8 text-slate-500 text-sm font-medium">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                >
                  Login here
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegistrationForm;
