// In src/App.js

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    onSnapshot,
    setDoc,
    updateDoc,
    addDoc,
    arrayUnion,
    arrayRemove,
    query,
    deleteDoc,
    getDoc
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

// --- UI Palette & Styles ---
const PALETTE = {
    background: '#F5F5F5', wood: '#3C2F2F', shelf: '#A1887F', text: '#4E342E', accent: '#D8A7B1',
    shadow: 'rgba(0, 0, 0, 0.2)',
    bookColors: ['#6D4C41', '#78909C', '#4A148C', '#3E2723', '#BF360C', '#0D47A1', '#004D40', '#33691E', '#F57F17', '#C2185B'],
    tagColors: ['#3E2723', '#BF360C', '#0D47A1', '#004D40', '#33691E', '#F57F17', '#C2185B', '#4A148C', '#880E4F', '#B71C1C']
};
const bodyFont = "'Lato', sans-serif";
const titleFont = "'Playfair Display', serif";
const spineFont = "'DM Serif Display', serif";

// --- Helper Components ---
const Spinner = () => <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>;

// --- Auth Component ---
const AuthComponent = ({ auth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (isLogin) { await signInWithEmailAndPassword(auth, email, password); }
            else {
                if (!displayName) { setError("Please enter a name."); setLoading(false); return; }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName });
                const userDocRef = doc(getFirestore(), `users/${userCredential.user.uid}`);
                await setDoc(userDocRef, { displayName, email });
            }
        } catch (err) { setError(err.message.replace('Firebase: ', '')); } finally { setLoading(false); }
    };

    return ( <div className="min-h-screen flex items-center justify-center p-4" style={{ background: PALETTE.background, fontFamily: bodyFont }}> <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border-t-4" style={{borderColor: PALETTE.wood}}> <h2 className="text-3xl font-bold text-center" style={{ color: PALETTE.text, fontFamily: titleFont }}>{isLogin ? 'Welcome to the Library' : 'Build Your Bookshelf'}</h2> <form onSubmit={handleSubmit} className="space-y-4"> {!isLogin && (<input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your Name" required className="w-full px-4 py-2 border rounded-md" />)} <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full px-4 py-2 border rounded-md" /> <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full px-4 py-2 border rounded-md" /> <button type="submit" disabled={loading} className="w-full px-4 py-3 font-semibold text-white rounded-md flex items-center justify-center" style={{backgroundColor: PALETTE.text}}>{loading ? <Spinner /> : (isLogin ? 'Enter Library' : 'Create Library')}</button> </form> {error && <p className="text-red-500 text-sm text-center">{error}</p>} <button onClick={() => setIsLogin(!isLogin)} className="w-full text-sm text-center" style={{color: PALETTE.text}}>{isLogin ? "Need a new library card? Sign Up" : "Already have a card? Login"}</button> </div> </div> );
};

// --- Library Components ---

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, shelfName }) => {
    if (!isOpen) return null;
    return ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}> <div className="bg-white rounded-lg shadow-2xl p-6 md:p-8 w-full max-w-md text-center" onClick={e => e.stopPropagation()}> <h2 className="text-2xl font-bold mb-4" style={{ color: PALETTE.text, fontFamily: titleFont }}>Delete Shelf?</h2> <p className="mb-6" style={{ fontFamily: bodyFont, color: '#424242' }}>Are you sure you want to permanently delete the shelf named <strong className="font-bold">"{shelfName}"</strong> and all of its books?</p> <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p> <div className="flex justify-center gap-4"> <button onClick={onClose} className="px-6 py-2 rounded-md bg-gray-200 hover:bg-gray-300 font-semibold" style={{color: PALETTE.text}}>Cancel</button> <button onClick={onConfirm} className="px-6 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700">Delete</button> </div> </div> </div> );
};

const AddBookModal = ({ shelfId, onClose, db, userId, bookToEdit, onUpdateBook }) => {
    const isEditMode = !!bookToEdit;
    
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [pages, setPages] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState([]);
    const [currentTag, setCurrentTag] = useState('');
    const [rating, setRating] = useState('');
    const [status, setStatus] = useState('incomplete');
    const [coverType, setCoverType] = useState('color');
    const [coverColor, setCoverColor] = useState(PALETTE.bookColors[0]);
    const [spineColor, setSpineColor] = useState(PALETTE.bookColors[1]);
    const [coverFile, setCoverFile] = useState(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatedImage, setGeneratedImage] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        if (isEditMode) {
            setTitle(bookToEdit.title || '');
            setAuthor(bookToEdit.author || '');
            setPages(bookToEdit.pages || '');
            setDescription(bookToEdit.description || '');
            setTags(bookToEdit.tags || []);
            setRating(bookToEdit.rating || '');
            setStatus(bookToEdit.status || 'incomplete');
            setSpineColor(bookToEdit.spineColor || PALETTE.bookColors[1]);
            setCoverColor(bookToEdit.coverColor || PALETTE.bookColors[0]);
        }
    }, [isEditMode, bookToEdit]);

    const handleTagInput = (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const newTag = currentTag.trim(); if (newTag && !tags.includes(newTag)) { setTags([...tags, newTag]); } setCurrentTag(''); } };
    const removeTag = (tagToRemove) => { setTags(tags.filter(tag => tag !== tagToRemove)); };
    const uploadToCloudinary = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData, });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error.message || 'Cloudinary upload failed');
        return data.secure_url;
    };
    const handleGenerateImage = async () => {
        if (!aiPrompt) return;
        setIsGenerating(true); setGeneratedImage(null);
        try {
            const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.REACT_APP_HUGGINGFACE_API_KEY}` }, body: JSON.stringify({ inputs: aiPrompt }), });
            if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Failed to generate image.'); }
            const imageBlob = await response.blob();
            const imageUrl = URL.createObjectURL(imageBlob);
            setGeneratedImage({ blob: imageBlob, url: imageUrl });
        } catch (error) { alert(error.message); } finally { setIsGenerating(false); }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title || !pages || !author || isSubmitting) return;
        setIsSubmitting(true);
        let bookData = { title, author, pages: parseInt(pages, 10), description, tags, rating: parseFloat(rating) || 0, status, spineColor, coverColor };
        
        try {
            // Handle image upload ONLY if a new one is provided
            if (coverType === 'upload' && coverFile) {
                const imageUrl = await uploadToCloudinary(coverFile);
                bookData.coverImageUrl = imageUrl;
            } else if (coverType === 'ai' && generatedImage) {
                const aiFile = new File([generatedImage.blob], `${aiPrompt.replace(/ /g, '_')}.jpeg`, { type: 'image/jpeg' });
                const imageUrl = await uploadToCloudinary(aiFile);
                bookData.coverImageUrl = imageUrl;
            } else if (isEditMode) {
                // Preserve the existing image URL if not uploading a new one
                bookData.coverImageUrl = bookToEdit.coverImageUrl;
            }

            if (isEditMode) {
                const finalBookData = { ...bookToEdit, ...bookData };
                await onUpdateBook(bookToEdit.shelfId, finalBookData);
            } else {
                const finalBookData = { ...bookData, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                const shelfRef = doc(db, `users/${userId}/shelves`, shelfId);
                await updateDoc(shelfRef, { books: arrayUnion(finalBookData) });
            }
            onClose();
        } catch (error) { console.error("Error saving book:", error); alert(`Failed to save book: ${error.message}`); }
        finally { setIsSubmitting(false); }
    };

    return ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ fontFamily: bodyFont }}> <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"> <h2 className="text-2xl font-bold mb-6" style={{ color: PALETTE.text, fontFamily: titleFont }}>{isEditMode ? 'Edit Book' : 'Add a Book'}</h2> <form onSubmit={handleSubmit} className="space-y-4"> <input type="text" placeholder="Book Title *" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-3 border rounded-md" /> <input type="text" placeholder="Author's Name *" value={author} onChange={e => setAuthor(e.target.value)} required className="w-full p-3 border rounded-md" /> <div className="flex gap-4"> <input type="number" placeholder="Total Pages *" value={pages} onChange={e => setPages(e.target.value)} required min="1" className="w-full p-3 border rounded-md" /> <input type="number" placeholder="Rating (0-5)" value={rating} onChange={e => setRating(e.target.value)} min="0" max="5" step="0.1" className="w-full p-3 border rounded-md" /> </div> <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-3 border rounded-md bg-white"> <option value="incomplete">Status: Incomplete</option> <option value="completed">Status: Completed</option> </select> <textarea placeholder="Description or notes..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border rounded-md h-24 resize-y"></textarea> <div> <label className="font-semibold block mb-2" style={{ color: PALETTE.text }}>Tags</label> <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md">{tags.map(tag => (<div key={tag} className="flex items-center gap-1 bg-gray-200 text-gray-700 text-sm font-semibold px-2 py-1 rounded-full"><span>{tag}</span><button type="button" onClick={() => removeTag(tag)} className="font-bold text-red-500 hover:text-red-700">&times;</button></div>))}<input type="text" value={currentTag} onChange={(e) => setCurrentTag(e.target.value)} onKeyDown={handleTagInput} placeholder="Add a tag..." className="flex-grow bg-transparent focus:outline-none"/></div><p className="text-xs text-gray-500 mt-1">Press Enter or Comma (,) to add a tag.</p> </div> <div className="pt-2"><label className="font-semibold block mb-2" style={{ color: PALETTE.text }}>Spine Color</label><div className="flex flex-wrap gap-2">{PALETTE.bookColors.map(color => (<button type="button" key={color} onClick={() => setSpineColor(color)} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${spineColor === color ? 'ring-4 ring-offset-2' : ''}`} style={{ backgroundColor: color, borderColor: PALETTE.accent }}></button>))}</div></div> <div className="space-y-3 pt-2"><label className="font-semibold" style={{ color: PALETTE.text }}>Cover Style (for front cover)</label><div className="flex gap-4">{['color', 'upload', 'ai'].map(type => (<button type="button" key={type} onClick={() => setCoverType(type)} className={`px-3 py-1 rounded-md text-sm capitalize transition-colors ${coverType === type ? 'text-white' : 'bg-gray-200'}`} style={{backgroundColor: coverType === type ? PALETTE.text : '#eee'}}>{type}</button>))}</div>{coverType === 'color' && ( <div className="pt-2"><label className="text-sm block mb-2">Front Cover Color:</label><div className="flex flex-wrap gap-2">{PALETTE.bookColors.map(color => (<button type="button" key={color} onClick={() => setCoverColor(color)} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${coverColor === color ? 'ring-4 ring-offset-2' : ''}`} style={{ backgroundColor: color, borderColor: PALETTE.accent }}></button>))}</div></div> )}{coverType === 'upload' && ( <input type="file" onChange={e => setCoverFile(e.target.files[0])} accept="image/*" className="w-full text-sm mt-2" /> )}{coverType === 'ai' && ( <div className="space-y-3 pt-2"><textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe the cover..." className="w-full p-2 border rounded-md"></textarea><button type="button" onClick={handleGenerateImage} disabled={isGenerating || !aiPrompt} className="px-4 py-2 bg-purple-600 text-white rounded-md">{isGenerating ? <Spinner/> : "Generate"}</button>{generatedImage && <img src={generatedImage.url} alt="AI generated cover" className="w-32 h-44 object-cover mt-2"/>}</div> )}</div> <div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 font-semibold">Cancel</button><button type="submit" className="px-6 py-2 rounded-md text-white font-semibold" style={{backgroundColor: PALETTE.text}}>{isEditMode ? 'Save Changes' : 'Add Book'}</button></div> </form> </div> </div> );
};

const getColorForTag = (tag) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) { hash = tag.charCodeAt(i) + ((hash << 5) - hash); }
    return PALETTE.tagColors[Math.abs(hash) % PALETTE.tagColors.length];
};

const StarRating = ({ rating }) => {
    const fullStars = Math.floor(rating);
    const partialStarWidth = (rating % 1) * 100;
    return (
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => {
                if (i < fullStars) { return <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>; }
                if (i === fullStars) {
                    return (
                        <div key={i} className="relative">
                            <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            <div className="absolute top-0 left-0 h-full overflow-hidden" style={{ width: `${partialStarWidth}%` }}><svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg></div>
                        </div>
                    );
                }
                return <svg key={i} className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>;
            })}
        </div>
    );
};

const BookSpine = ({ book, onClick }) => {
    const thickness = useMemo(() => Math.max(24, Math.min(book.pages / 8, 55)), [book.pages]);
    const spineColor = book.spineColor || book.coverColor || '#A1887F';
    const randomHeightOffset = useMemo(() => Math.random() * 10 - 5, []);
    const titleLength = book.title.length;
    const fontSize = useMemo(() => {
        if (thickness < 30 && titleLength > 15) return '10px';
        if (titleLength > 20) return '11px';
        return '13px';
    }, [thickness, titleLength]);
    return ( <div className="group relative flex-shrink-0 h-[240px] cursor-pointer transform transition-transform duration-200 hover:-translate-y-2 mr-2" style={{ width: `${thickness}px`, marginTop: `${randomHeightOffset}px` }} onClick={onClick}> <div className="absolute top-0 left-[3px] w-full h-full bg-[#fdfaf5]" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/lined-paper.png')`, boxShadow: 'inset 3px 0 5px rgba(0,0,0,0.25)' }}></div> <div className="absolute top-0 left-0 w-full h-full flex flex-col justify-between p-1" style={{ backgroundColor: spineColor, backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.3), transparent 10%, transparent 90%, rgba(0,0,0,0.3))`, boxShadow: '3px 0 6px rgba(0,0,0,0.4)' }}> <div className="h-2 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 opacity-70"></div> <span className="text-white font-bold text-center overflow-hidden flex-grow flex items-center justify-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontFamily: spineFont, fontSize: fontSize, color: '#FFD700', textShadow: '1px 1px 1px rgba(0,0,0,0.9)', letterSpacing: '1.5px', padding: '5px 0' }}>{book.title}</span> <div className="h-2 w-full bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 opacity-70"></div> </div> </div> );
};

const BookDetailModal = ({ book, onClose, onRemove, onEdit }) => {
    // --- UPDATED: The entire card content is now scrollable ---
    const [isFlipped, setIsFlipped] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setIsFlipped(true), 100); return () => clearTimeout(timer); }, []);
    const handleBackgroundClick = (e) => { if (e.target === e.currentTarget) onClose(); };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-40" onClick={handleBackgroundClick} style={{ perspective: '2000px', fontFamily: bodyFont }}>
            <div className={`relative w-full max-w-4xl h-[90vh] max-h-[600px] transition-transform duration-1000`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : '' }}>

                {/* Back of the card (details). NOTE: 'overflow-hidden' was removed from this container to allow child scrolling. */}
                <div className="absolute w-full h-full bg-white shadow-2xl rounded-lg flex flex-col md:flex-row" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    
                    {/* Cover Image */}
                    <div className="w-full md:w-1/3 h-1/3 md:h-full flex-shrink-0 bg-cover bg-center" style={{ backgroundColor: book.coverColor, backgroundImage: `url(${book.coverImageUrl})` }}></div>
                    
                    {/* Scrollable Content Panel (All content scrolls together) */}
                    <div className="p-6 md:p-8 flex flex-col flex-grow overflow-y-auto min-h-0">
                        <h2 className="text-3xl font-bold" style={{ color: PALETTE.text, fontFamily: titleFont }}>{book.title}</h2>
                        <h3 className="text-xl text-gray-500 mb-2" style={{ fontFamily: titleFont }}>by {book.author || 'Unknown'}</h3>

                        <div className="flex items-center gap-4 mb-4">
                            <StarRating rating={book.rating || 0} />
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${book.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{book.status || 'Incomplete'}</span>
                        </div>

                        <p className="text-gray-500 mb-6">Pages: {book.pages}</p>

                        {book.tags && book.tags.length > 0 && (
                            <div className="mb-6 flex flex-wrap gap-2">
                                {book.tags.map(tag => (<span key={tag} className="text-white text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: getColorForTag(tag) }}>{tag}</span>))}
                            </div>
                        )}

                        <div className="text-gray-700 space-y-4">
                            <h3 className="font-bold text-lg" style={{ color: PALETTE.text }}>Description</h3>
                            <p className="whitespace-pre-wrap">{book.description || "No description."}</p>
                        </div>

                        {/* Buttons are pushed to the bottom by mt-auto */}
                        <div className="mt-auto pt-6 flex gap-4">
                            <button onClick={onEdit} className="self-start px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Edit</button>
                            <button onClick={onRemove} className="self-start px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Remove</button>
                        </div>
                    </div>
                </div>

                {/* Front of the card */}
                <div className="absolute w-full h-full bg-gray-300 shadow-2xl rounded-lg bg-cover bg-center" style={{ backfaceVisibility: 'hidden', backgroundColor: book.coverColor, backgroundImage: `url(${book.coverImageUrl})` }}></div>
            </div>
        </div>
    );
};

const Footer = () => {
    const GoogleIcon = () => (
        <svg viewBox="0 0 24 24" className="w-4 h-4 inline-block mx-1" aria-hidden="true">
            <path fill="#4285F4" d="M22.56,12.25C22.56,11.45 22.49,10.66 22.35,9.88H12V14.5H18.02C17.72,16.14 16.76,17.56 15.1,18.52V21.1H19.22C21.43,19.03 22.56,15.93 22.56,12.25Z"/>
            <path fill="#34A853" d="M12,23C15.24,23 17.96,21.92 19.92,20.19L15.82,17.41C14.76,18.1 13.5,18.52 12,18.52C9.09,18.52 6.6,16.63 5.74,14.05H1.54V16.83C3.47,20.57 7.4,23 12,23Z"/>
            <path fill="#FBBC05" d="M5.74,14.05C5.5,13.37 5.37,12.68 5.37,12C5.37,11.32 5.5,10.63 5.74,9.95V7.17H1.54C0.58,9.1 0,10.99 0,12C0,13.01 0.58,14.9 1.54,16.83L5.74,14.05Z"/>
            <path fill="#EA4335" d="M12,5.48C13.84,5.48 15.35,6.08 16.43,7.1L19.92,3.62C17.96,1.86 15.24,0.91 12,0.91C7.4,0.91 3.47,3.43 1.54,7.17L5.74,9.95C6.6,7.37 9.09,5.48 12,5.48Z"/>
        </svg>
    );

    return (
        <footer className="w-full text-center py-8 mt-12">
            <p className="text-sm text-white/50">
                Made with <GoogleIcon /> by Nikita
            </p>
        </footer>
    );
};

const LibraryView = ({ shelves, user, onAddShelf, onDeleteShelf, db, auth, onUpdateBook }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [shelfToDelete, setShelfToDelete] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [shelfForNewBook, setShelfForNewBook] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [bookToEdit, setBookToEdit] = useState(null);
    const [viewedBook, setViewedBook] = useState(null);
    const [newShelfName, setNewShelfName] = useState('');
    const [filters, setFilters] = useState({ rating: 'all', status: 'all' });
    const [showFilters, setShowFilters] = useState(false);

    const filteredShelves = useMemo(() => {
        return shelves.map(shelf => {
            const filteredBooks = shelf.books?.filter(book => {
                const statusMatch = filters.status === 'all' || book.status === filters.status;
                let ratingMatch = true;
                if (filters.rating === '3-and-up') { ratingMatch = (book.rating || 0) >= 3; }
                else if (filters.rating === 'below-3') { ratingMatch = (book.rating || 0) < 3; }
                return statusMatch && ratingMatch;
            });
            return { ...shelf, books: filteredBooks };
        });
    }, [shelves, filters]);

    const searchResults = useMemo(() => {
        if (!searchQuery) return [];
        const lowercasedQuery = searchQuery.toLowerCase();
        const results = [];
        filteredShelves.forEach(shelf => { shelf.books?.forEach(book => {
            const inTitle = book.title?.toLowerCase().includes(lowercasedQuery);
            const inAuthor = book.author?.toLowerCase().includes(lowercasedQuery);
            const inDescription = book.description?.toLowerCase().includes(lowercasedQuery);
            const inTags = book.tags?.some(tag => tag.toLowerCase().includes(lowercasedQuery));
            if (inTitle || inAuthor || inDescription || inTags) { results.push({ ...book, shelfName: shelf.name, shelfId: shelf.id }); }
        }); });
        return results;
    }, [searchQuery, filteredShelves]);

    const handleOpenBook = (book) => { setViewedBook(book); setSearchQuery(''); };
    const handleAddShelf = async (e) => { e.preventDefault(); if (!newShelfName.trim()) return; await onAddShelf(newShelfName); setNewShelfName(''); };
    const handleOpenAddBook = (shelfId) => { setShelfForNewBook(shelfId); setIsAddModalOpen(true); };
    const handleRemoveBook = async () => { if (!viewedBook) return; const shelf = shelves.find(s => s.id === viewedBook.shelfId); const bookToRemove = shelf?.books.find(b => b.id === viewedBook.id); if (!bookToRemove) return; try { const shelfRef = doc(db, `users/${user.uid}/shelves`, viewedBook.shelfId); await updateDoc(shelfRef, { books: arrayRemove(bookToRemove) }); setViewedBook(null); } catch (error) { console.error("Error removing book:", error); } };
    const handleOpenDeleteModal = (shelf) => { setShelfToDelete(shelf); setIsDeleteModalOpen(true); };
    const handleConfirmDelete = () => { if (shelfToDelete) { onDeleteShelf(shelfToDelete.id); } setIsDeleteModalOpen(false); setShelfToDelete(null); };
    const handleOpenEditModal = () => { setBookToEdit(viewedBook); setViewedBook(null); setIsEditModalOpen(true); };

    return (
        <div className="h-full w-full flex flex-col" style={{ fontFamily: bodyFont, backgroundImage: `radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.9) 100%), url('https://www.transparenttextures.com/patterns/dark-wood.png'), linear-gradient(to right, #3C2F2F, #4E342E)` }}>
            <header className="px-4 pt-4 sm:px-6 lg:px-8 flex-shrink-0 z-10">
                 <div className="w-full flex justify-center items-center gap-2 mb-4"> <div className="flex-grow max-w-lg relative"> <input type="text" placeholder="Search books..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-2 pl-10 border rounded-full bg-white/20 text-white placeholder-white/50 focus:bg-white/30 focus:outline-none" /> <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> {searchQuery && (<div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg overflow-hidden z-10">{searchResults.length > 0 ? (<ul>{searchResults.slice(0, 10).map(book => (<li key={book.id} onClick={() => handleOpenBook(book)} className="p-3 hover:bg-gray-100 cursor-pointer border-b"><p className="font-bold">{book.title}</p><p className="text-sm text-gray-600">by {book.author} on "{book.shelfName}"</p></li>))}</ul>) : (<p className="p-3 text-sm text-gray-500">No results found.</p>)}</div>)} </div> <div className="relative"> <button onClick={() => setShowFilters(!showFilters)} className="p-2 bg-white/20 rounded-full text-white"> <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-5.414 5.414a1 1 0 00-.293.707V19l-4 2v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg> </button> {showFilters && ( <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl p-4 z-20"> <label className="block text-sm font-bold text-gray-700">Rating</label> <select value={filters.rating} onChange={e => setFilters({...filters, rating: e.target.value})} className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"> <option value="all">All Ratings</option> <option value="3-and-up">3 stars & up</option> <option value="below-3">Below 3 stars</option> </select> <label className="block text-sm font-bold text-gray-700 mt-4">Status</label> <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="mt-1 block w-full p-2 border-gray-300 rounded-md shadow-sm"> <option value="all">All</option> <option value="completed">Completed</option> <option value="incomplete">Incomplete</option> </select> </div> )} </div> </div>
                <div className="flex justify-between items-center"><div className="w-1/3"></div><h1 className="w-1/3 text-xl sm:text-4xl md:text-5xl font-extrabold text-center text-white" style={{ fontFamily: titleFont, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>{user.displayName ? `${user.displayName}'s Library` : "My Library"}</h1><div className="w-1/3 flex justify-end"><button onClick={() => signOut(auth)} className="flex items-center justify-center bg-red-500 text-white hover:bg-red-700 transition-colors p-2 md:px-4 md:py-2 rounded-full md:rounded-md"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" /></svg><span className="hidden md:inline ml-2">Logout</span></button></div></div>
            </header>
            <div className="flex-grow overflow-y-auto p-4 sm:p-6 lg:p-8 min-h-0">
                <div className="max-w-xl mx-auto mb-12 p-4 bg-black/20 rounded-lg shadow-md"><form onSubmit={handleAddShelf} className="flex flex-col sm:flex-row gap-2"><input type="text" value={newShelfName} onChange={e => setNewShelfName(e.target.value)} placeholder="Name a new shelf..." className="flex-grow p-3 border border-white/20 rounded-md bg-white/10 text-white placeholder-white/50" /><button type="submit" className="px-6 py-3 text-white font-semibold rounded-md" style={{backgroundColor: PALETTE.text}}>Create</button></form></div>
                <div className="space-y-16">{filteredShelves.map(shelf => (<div key={shelf.id}><div className="flex justify-between items-center mb-8 relative z-10"><div className="relative -ml-4 shadow-lg"><div className="absolute -inset-1 bg-gradient-to-br from-amber-200 to-amber-400 rounded-sm transform -skew-y-3"></div><h2 className="relative px-4 py-1 bg-[#fdfaf5]" style={{backgroundImage: `url('https://www.transparenttextures.com/patterns/old-paper.png')`}}><span className="text-2xl font-bold" style={{ color: PALETTE.text, fontFamily: titleFont }}>{shelf.name}</span></h2></div><div className="flex items-center gap-4"><button onClick={() => handleOpenDeleteModal(shelf)} className="w-8 h-8 flex items-center justify-center bg-red-600 rounded-full text-white hover:bg-red-700" title="Delete shelf"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" /></svg></button><button onClick={() => handleOpenAddBook(shelf.id)} className="px-3 py-1 text-white text-sm font-semibold rounded-md" style={{backgroundColor: PALETTE.accent}}>+ Add Book</button></div></div>
                    <div className="relative" style={{filter: 'drop-shadow(0 5px 5px rgba(0,0,0,0.5))'}}>
                         <div className="min-h-[250px] pb-6">{shelf.books?.length > 0 && <div className="flex items-end gap-2 overflow-x-auto px-4">{shelf.books.map(book => <BookSpine key={book.id} book={book} onClick={() => setViewedBook({...book, shelfId: shelf.id})} />)}</div>}</div>
                        <div className="h-6 rounded-b-sm" style={{backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1)), url('https://www.transparenttextures.com/patterns/dark-wood.png')`, boxShadow: '0 -2px 5px rgba(0,0,0,0.01) inset'}}></div>
                    </div>
                </div>))}</div>
                <Footer />
            </div>
            {isAddModalOpen && ( <AddBookModal shelfId={shelfForNewBook} onClose={() => setIsAddModalOpen(false)} db={db} userId={user.uid} /> )}
            {isEditModalOpen && bookToEdit && ( <AddBookModal bookToEdit={bookToEdit} onClose={() => setIsEditModalOpen(false)} db={db} userId={user.uid} onUpdateBook={onUpdateBook}/> )}
            {viewedBook && ( <BookDetailModal book={viewedBook} onClose={() => setViewedBook(null)} onRemove={handleRemoveBook} onEdit={handleOpenEditModal} /> )}
            <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleConfirmDelete} shelfName={shelfToDelete?.name} />
        </div>
    );
};

const FairyLights = () => {
    return (
        <div className="absolute top-0 left-0 w-full h-10 overflow-hidden z-20 pointer-events-none">
            <div className="flex justify-around">
                {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="relative w-1 h-1 rounded-full bg-yellow-300" style={{
                        animation: `twinkle 2s infinite ease-in-out ${Math.random() * 2}s`,
                        boxShadow: '0 0 5px 2px rgba(255, 223, 150, 0.7)',
                    }}>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes twinkle {
                    0%, 100% { opacity: 0.4; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
};

const LibraryWrapper = ({ user, shelves, onAddShelf, onDeleteShelf, db, auth, onUpdateBook }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);
    const handleToggleCabinet = () => { if (!isOpen) { setIsOpen(true); setTimeout(() => setContentVisible(true), 500); } };
    const doorStyle = { backfaceVisibility: 'hidden', backgroundImage: `url('https://www.transparenttextures.com/patterns/dark-wood.png'), linear-gradient(to right, #3C2F2F, #4E342E)`, transition: 'transform 2.5s cubic-bezier(0.77, 0, 0.175, 1)' };
    return ( <div className="w-full h-screen bg-black overflow-hidden" style={{ perspective: '1500px' }}> <div className={`relative w-full h-full`} style={{ transformStyle: 'preserve-3d' }}> <div className={`absolute inset-0 transition-opacity duration-1000 delay-500 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}> <FairyLights /> <LibraryView shelves={shelves} user={user} onAddShelf={onAddShelf} onDeleteShelf={onDeleteShelf} db={db} auth={auth} onUpdateBook={onUpdateBook} /> </div> <div onClick={handleToggleCabinet} className={`absolute inset-0 flex items-center justify-center cursor-pointer z-20 transition-opacity duration-1000 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}> <div className="text-center"> <h1 className="text-4xl md:text-6xl text-white font-bold tracking-widest" style={{ fontFamily: titleFont, textShadow: '0 0 15px rgba(255,223,186,0.5)' }}>The Library</h1> <p className="text-white/70 mt-4 tracking-[0.2em] animate-pulse">Click to Enter</p> </div> </div> <div className="absolute top-0 left-0 w-1/2 h-full p-8 flex flex-col justify-between border-r-2 border-black origin-left shadow-2xl" style={{ ...doorStyle, transform: isOpen ? 'rotateY(-130deg)' : 'rotateY(0deg)' }}> <div className="h-1/4 w-full border-4 border-transparent p-2" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}></div><div className="h-1/3 w-full border-4 border-transparent p-2 relative" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}><div className="absolute top-1/2 -right-6 -translate-y-1/2 w-4 h-16 rounded-full" style={{background: 'linear-gradient(145deg, #b08d57, #8a6e45)'}}></div></div><div className="h-1/4 w-full border-4 border-transparent p-2" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}></div> </div> <div className="absolute top-0 right-0 w-1/2 h-full p-8 flex flex-col justify-between border-l-2 border-black origin-right shadow-2xl" style={{ ...doorStyle, transform: isOpen ? 'rotateY(130deg)' : 'rotateY(0deg)' }}> <div className="h-1/4 w-full border-4 border-transparent p-2" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}></div><div className="h-1/3 w-full border-4 border-transparent p-2 relative" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}><div className="absolute top-1/2 -left-6 -translate-y-1/2 w-4 h-16 rounded-full" style={{background: 'linear-gradient(145deg, #b08d57, #8a6e45)'}}></div></div><div className="h-1/4 w-full border-4 border-transparent p-2" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}></div> </div> </div> </div> );
};

export default function App() {
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [shelves, setShelves] = useState([]);

    useEffect(() => {
        const fontLink = document.createElement('link');
        fontLink.href = "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=DM+Serif+Display&family=Lato:wght@400;700&family=Playfair+Display:wght@700&display=swap";
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
        try {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setAuth(authInstance); setDb(dbInstance);
            onAuthStateChanged(authInstance, (currentUser) => { setUser(currentUser); setIsLoading(false); });
        } catch (error) { console.error("Firebase initialization failed:", error); setIsLoading(false); }
    }, []);

    useEffect(() => {
        if (!db || !user) { setShelves([]); return; };
        const shelvesRef = collection(db, `users/${user.uid}/shelves`);
        const q = query(shelvesRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const shelvesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            shelvesData.sort((a,b) => (a.createdAt > b.createdAt) ? 1 : -1);
            setShelves(shelvesData);
        });
        return () => unsubscribe();
    }, [db, user]);

    const handleAddShelf = async (shelfName) => {
        if (!db || !user) return;
        await addDoc(collection(db, `users/${user.uid}/shelves`), { name: shelfName, books: [], createdAt: new Date().toISOString() });
    };

    const handleDeleteShelf = async (shelfId) => {
        if (!db || !user) return;
        try {
            const shelfRef = doc(db, `users/${user.uid}/shelves`, shelfId);
            await deleteDoc(shelfRef);
        } catch (error) { console.error("Error deleting shelf:", error); alert("Failed to delete shelf."); }
    };

    const handleUpdateBook = async (shelfId, updatedBook) => {
        if (!db || !user) return;
        const shelfRef = doc(db, `users/${user.uid}/shelves`, shelfId);
        try {
            const shelfSnap = await getDoc(shelfRef);
            if (shelfSnap.exists()) {
                const currentBooks = shelfSnap.data().books || [];
                const bookIndex = currentBooks.findIndex(book => book.id === updatedBook.id);
                if (bookIndex > -1) {
                    currentBooks[bookIndex] = updatedBook;
                    await updateDoc(shelfRef, { books: currentBooks });
                }
            }
        } catch (error) { console.error("Error updating book: ", error); alert("Failed to save changes."); }
    };

    if (isLoading) { return <div className="min-h-screen flex items-center justify-center bg-black text-white">Loading Library...</div>; }
    if (!user) { return <AuthComponent auth={auth} />; }
    
    return <LibraryWrapper shelves={shelves} user={user} onAddShelf={handleAddShelf} onDeleteShelf={handleDeleteShelf} onUpdateBook={handleUpdateBook} db={db} auth={auth} />;
}
