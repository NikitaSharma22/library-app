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
    deleteDoc
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
const spineFont = "'Cinzel Decorative', 'serif'";

// --- Helper Components ---
const Spinner = () => <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>;

// --- Auth Component ---
const AuthComponent = ({ auth }) => {
    // This component remains the same
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
    // This component remains the same
    if (!isOpen) return null;
    return ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}> <div className="bg-white rounded-lg shadow-2xl p-6 md:p-8 w-full max-w-md text-center" onClick={e => e.stopPropagation()}> <h2 className="text-2xl font-bold mb-4" style={{ color: PALETTE.text, fontFamily: titleFont }}>Delete Shelf?</h2> <p className="mb-6" style={{ fontFamily: bodyFont, color: '#424242' }}>Are you sure you want to permanently delete the shelf named <strong className="font-bold">"{shelfName}"</strong> and all of its books?</p> <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p> <div className="flex justify-center gap-4"> <button onClick={onClose} className="px-6 py-2 rounded-md bg-gray-200 hover:bg-gray-300 font-semibold" style={{color: PALETTE.text}}>Cancel</button> <button onClick={onConfirm} className="px-6 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700">Delete</button> </div> </div> </div> );
};

const AddBookModal = ({ shelfId, onClose, db, userId }) => {
    // This component remains the same
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [pages, setPages] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState([]);
    const [currentTag, setCurrentTag] = useState('');
    const [coverType, setCoverType] = useState('color');
    const [coverColor, setCoverColor] = useState(PALETTE.bookColors[0]);
    const [spineColor, setSpineColor] = useState(PALETTE.bookColors[1]);
    const [coverFile, setCoverFile] = useState(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatedImage, setGeneratedImage] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        let coverData = { coverColor, spineColor };
        try {
            if (coverType === 'upload' && coverFile) { const imageUrl = await uploadToCloudinary(coverFile); coverData = { ...coverData, coverImageUrl: imageUrl }; }
            else if (coverType === 'ai' && generatedImage) {
                const aiFile = new File([generatedImage.blob], `${aiPrompt.replace(/ /g, '_')}.jpeg`, { type: 'image/jpeg' });
                const imageUrl = await uploadToCloudinary(aiFile); coverData = { ...coverData, coverImageUrl: imageUrl };
            }
            const shelfRef = doc(db, `users/${userId}/shelves`, shelfId);
            await updateDoc(shelfRef, { books: arrayUnion({ id: crypto.randomUUID(), title, author, pages: parseInt(pages, 10), description, tags, createdAt: new Date().toISOString(), ...coverData }) });
            onClose();
        } catch (error) { console.error("Error adding book:", error); alert(`Failed to add book: ${error.message}`); }
        finally { setIsSubmitting(false); }
    };

    return ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ fontFamily: bodyFont }}> <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"> <h2 className="text-2xl font-bold mb-6" style={{ color: PALETTE.text, fontFamily: titleFont }}>Add a Book</h2> <form onSubmit={handleSubmit} className="space-y-4"> <input type="text" placeholder="Book Title *" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-3 border rounded-md" /> <input type="text" placeholder="Author's Name *" value={author} onChange={e => setAuthor(e.target.value)} required className="w-full p-3 border rounded-md" /> <input type="number" placeholder="Total Pages *" value={pages} onChange={e => setPages(e.target.value)} required min="1" className="w-full p-3 border rounded-md" /> <textarea placeholder="Description or notes..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border rounded-md h-24 resize-y"></textarea> <div> <label className="font-semibold block mb-2" style={{ color: PALETTE.text }}>Tags</label> <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md">{tags.map(tag => (<div key={tag} className="flex items-center gap-1 bg-gray-200 text-gray-700 text-sm font-semibold px-2 py-1 rounded-full"><span>{tag}</span><button type="button" onClick={() => removeTag(tag)} className="font-bold text-red-500 hover:text-red-700">&times;</button></div>))}<input type="text" value={currentTag} onChange={(e) => setCurrentTag(e.target.value)} onKeyDown={handleTagInput} placeholder="Add a tag..." className="flex-grow bg-transparent focus:outline-none"/></div><p className="text-xs text-gray-500 mt-1">Press Enter or Comma (,) to add a tag.</p> </div> <div className="pt-2"><label className="font-semibold block mb-2" style={{ color: PALETTE.text }}>Spine Color</label><div className="flex flex-wrap gap-2">{PALETTE.bookColors.map(color => (<button type="button" key={color} onClick={() => setSpineColor(color)} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${spineColor === color ? 'ring-4 ring-offset-2' : ''}`} style={{ backgroundColor: color, borderColor: PALETTE.accent }}></button>))}</div></div> <div className="space-y-3 pt-2"><label className="font-semibold" style={{ color: PALETTE.text }}>Cover Style</label><div className="flex gap-4">{['color', 'upload', 'ai'].map(type => (<button type="button" key={type} onClick={() => setCoverType(type)} className={`px-3 py-1 rounded-md text-sm capitalize transition-colors ${coverType === type ? 'text-white' : 'bg-gray-200'}`} style={{backgroundColor: coverType === type ? PALETTE.text : '#eee'}}>{type}</button>))}</div>{coverType === 'color' && ( <div className="pt-2"><label className="text-sm block mb-2">Front Cover Color:</label><div className="flex flex-wrap gap-2">{PALETTE.bookColors.map(color => (<button type="button" key={color} onClick={() => setCoverColor(color)} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${coverColor === color ? 'ring-4 ring-offset-2' : ''}`} style={{ backgroundColor: color, borderColor: PALETTE.accent }}></button>))}</div></div> )}{coverType === 'upload' && ( <input type="file" onChange={e => setCoverFile(e.target.files[0])} accept="image/*" className="w-full text-sm mt-2" /> )}{coverType === 'ai' && ( <div className="space-y-3 pt-2"><textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe the cover..." className="w-full p-2 border rounded-md"></textarea><button type="button" onClick={handleGenerateImage} disabled={isGenerating || !aiPrompt} className="px-4 py-2 bg-purple-600 text-white rounded-md">{isGenerating ? <Spinner/> : "Generate"}</button>{generatedImage && <img src={generatedImage.url} alt="AI generated cover" className="w-32 h-44 object-cover mt-2"/>}</div> )}</div> <div className="mt-8 flex justify-end gap-4"><button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 font-semibold">Cancel</button><button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-md text-white font-semibold" style={{backgroundColor: PALETTE.text}}>{isSubmitting ? <Spinner/> : 'Add Book'}</button></div> </form> </div> </div> );
};

const getColorForTag = (tag) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) { hash = tag.charCodeAt(i) + ((hash << 5) - hash); }
    return PALETTE.tagColors[Math.abs(hash) % PALETTE.tagColors.length];
};

const BookSpine = ({ book, onClick }) => {
    // This component remains the same
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

const BookDetailModal = ({ book, onClose, onRemove }) => {
    // This component remains the same
    const [isFlipped, setIsFlipped] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setIsFlipped(true), 100); return () => clearTimeout(timer); }, []);
    const handleBackgroundClick = (e) => { if (e.target === e.currentTarget) onClose(); };
    return ( <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-40" onClick={handleBackgroundClick} style={{ perspective: '2000px', fontFamily: bodyFont }}> <div className={`relative w-full max-w-4xl h-[90vh] max-h-[600px] transition-transform duration-1000`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : '' }}> <div className="absolute w-full h-full bg-white shadow-2xl rounded-lg flex flex-col md:flex-row overflow-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}> <div className="w-full md:w-1/3 h-1/3 md:h-full flex-shrink-0" style={{ backgroundColor: book.coverColor, backgroundImage: `url(${book.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div> <div className="p-6 md:p-8 flex flex-col flex-grow overflow-y-auto min-h-0"> <h2 className="text-3xl font-bold" style={{color: PALETTE.text, fontFamily: titleFont}}>{book.title}</h2> <h3 className="text-xl text-gray-500 mb-4" style={{fontFamily: titleFont}}>by {book.author || 'Unknown'}</h3> <p className="text-gray-500 mb-6 flex-shrink-0">Pages: {book.pages}</p> {book.tags && book.tags.length > 0 && (<div className="mb-6 flex flex-wrap gap-2">{book.tags.map(tag => (<span key={tag} className="text-white text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: getColorForTag(tag) }}>{tag}</span>))}</div>)} <div className="text-gray-700 space-y-4 flex-grow"><h3 className="font-bold text-lg" style={{color: PALETTE.text}}>Description</h3><p className="whitespace-pre-wrap">{book.description || "No description."}</p></div> <button onClick={onRemove} className="mt-6 self-start px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex-shrink-0">Remove</button> </div> </div> <div className="absolute w-full h-full bg-gray-300 shadow-2xl rounded-lg" style={{ backfaceVisibility: 'hidden', backgroundColor: book.coverColor, backgroundImage: `url(${book.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div> </div> </div> );
};

const LibraryView = ({ shelves, user, onAddShelf, onDeleteShelf, db, auth }) => {
    // This component remains the same
    const [searchQuery, setSearchQuery] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [shelfToDelete, setShelfToDelete] = useState(null);
    const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
    const [selectedShelfIdForBook, setSelectedShelfIdForBook] = useState(null);
    const [viewedBook, setViewedBook] = useState(null);
    const [newShelfName, setNewShelfName] = useState('');

    const searchResults = useMemo(() => {
        if (!searchQuery) return [];
        const lowercasedQuery = searchQuery.toLowerCase();
        const results = [];
        shelves.forEach(shelf => { shelf.books?.forEach(book => {
            const inTitle = book.title?.toLowerCase().includes(lowercasedQuery);
            const inAuthor = book.author?.toLowerCase().includes(lowercasedQuery);
            const inDescription = book.description?.toLowerCase().includes(lowercasedQuery);
            const inTags = book.tags?.some(tag => tag.toLowerCase().includes(lowercasedQuery));
            if (inTitle || inAuthor || inDescription || inTags) { results.push({ ...book, shelfName: shelf.name, shelfId: shelf.id }); }
        }); });
        return results;
    }, [searchQuery, shelves]);

    const handleOpenBook = (book) => { setViewedBook(book); setSearchQuery(''); };
    const handleAddShelf = async (e) => { e.preventDefault(); if (!newShelfName.trim()) return; await onAddShelf(newShelfName); setNewShelfName(''); };
    const handleOpenAddBook = (shelfId) => { setSelectedShelfIdForBook(shelfId); setIsAddBookModalOpen(true); };
    const handleRemoveBook = async () => { if (!viewedBook) return; const shelf = shelves.find(s => s.id === viewedBook.shelfId); const bookToRemove = shelf?.books.find(b => b.id === viewedBook.id); if (!bookToRemove) return; try { const shelfRef = doc(db, `users/${user.uid}/shelves`, viewedBook.shelfId); await updateDoc(shelfRef, { books: arrayRemove(bookToRemove) }); setViewedBook(null); } catch (error) { console.error("Error removing book:", error); } };
    const handleOpenDeleteModal = (shelf) => { setShelfToDelete(shelf); setIsDeleteModalOpen(true); };
    const handleConfirmDelete = () => { if (shelfToDelete) { onDeleteShelf(shelfToDelete.id); } setIsDeleteModalOpen(false); setShelfToDelete(null); };

    return (
        <div className="h-full w-full p-4 sm:p-6 lg:p-8" style={{ fontFamily: bodyFont, background: `radial-gradient(ellipse at top, #5a4a42, #3c2f2f)` }}>
            <div className="max-w-7xl mx-auto flex flex-col h-full">
                <header className="mb-8 flex-shrink-0">
                    <div className="w-full flex justify-center mb-4">
                        <div className="w-full max-w-lg relative">
                            <input type="text" placeholder="Search books..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-2 pl-10 border rounded-full bg-white/20 text-white placeholder-white/50 focus:bg-white/30 focus:outline-none" />
                            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {searchQuery && (<div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg overflow-hidden z-10">{searchResults.length > 0 ? (<ul>{searchResults.slice(0, 10).map(book => (<li key={book.id} onClick={() => handleOpenBook(book)} className="p-3 hover:bg-gray-100 cursor-pointer border-b"><p className="font-bold">{book.title}</p><p className="text-sm text-gray-600">by {book.author} on "{book.shelfName}"</p></li>))}</ul>) : (<p className="p-3 text-sm text-gray-500">No results found.</p>)}</div>)}
                        </div>
                    </div>
                    <div className="flex justify-between items-center"><div className="w-1/3"></div><h1 className="w-1/3 text-xl sm:text-4xl md:text-5xl font-extrabold text-center text-white" style={{ fontFamily: titleFont, textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>{user.displayName ? `${user.displayName}'s Library` : "My Library"}</h1><div className="w-1/3 flex justify-end"><button onClick={() => signOut(auth)} className="flex items-center justify-center bg-red-500 text-white hover:bg-red-700 transition-colors p-2 md:px-4 md:py-2 rounded-full md:rounded-md"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg><span className="hidden md:inline ml-2">Logout</span></button></div></div>
                </header>
                
                <div className="flex-grow overflow-y-auto pr-2">
                    <div className="max-w-xl mx-auto mb-12 p-4 bg-black/20 rounded-lg shadow-md"><form onSubmit={handleAddShelf} className="flex gap-2"><input type="text" value={newShelfName} onChange={e => setNewShelfName(e.target.value)} placeholder="Name a new shelf..." className="flex-grow p-3 border border-white/20 rounded-md bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-400" /><button type="submit" className="px-6 py-3 text-white font-semibold rounded-md" style={{backgroundColor: PALETTE.text}}>Create</button></form></div>
                    <div className="space-y-12">{shelves.map(shelf => (<div key={shelf.id}><div className="flex justify-between items-center mb-2"><h2 className="text-2xl font-bold text-white" style={{ fontFamily: titleFont, textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>{shelf.name}</h2><div className="flex items-center gap-4"><button onClick={() => handleOpenDeleteModal(shelf)} className="w-8 h-8 flex items-center justify-center bg-red-600 rounded-full text-white hover:bg-red-700" title="Delete shelf"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button><button onClick={() => handleOpenAddBook(shelf.id)} className="px-3 py-1 text-white text-sm font-semibold rounded-md" style={{backgroundColor: PALETTE.accent}}>+ Add Book</button></div></div><div className="relative pt-4 pb-2" style={{ backgroundColor: '#212121', backgroundImage: `url('https://www.transparenttextures.com/patterns/wood-pattern.png')`, boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 6px 10px -5px rgba(0,0,0,0.7)'}}><div className="flex items-end gap-2 overflow-x-auto px-4 min-h-[250px]">{(shelf.books || []).map(book => <BookSpine key={book.id} book={book} onClick={() => setViewedBook({...book, shelfId: shelf.id})} />)}</div><div className="h-4" style={{backgroundColor: '#372d29', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.4)'}}></div></div></div>))}</div>
                </div>

                {isAddBookModalOpen && ( <AddBookModal shelfId={selectedShelfIdForBook} onClose={() => setIsAddBookModalOpen(false)} db={db} userId={user.uid} /> )}
                {viewedBook && ( <BookDetailModal book={viewedBook} onClose={() => setViewedBook(null)} onRemove={handleRemoveBook} /> )}
                <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleConfirmDelete} shelfName={shelfToDelete?.name} />
            </div>
        </div>
    );
};

const LibraryWrapper = ({ user, shelves, onAddShelf, onDeleteShelf, db, auth }) => {
    // This component remains the same
    const [isOpen, setIsOpen] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);
    const handleToggleCabinet = () => { if (!isOpen) { setIsOpen(true); setTimeout(() => setContentVisible(true), 1000); } };
    const doorStyle = { backfaceVisibility: 'hidden', backgroundImage: `url('https://www.transparenttextures.com/patterns/dark-wood.png'), linear-gradient(to right, #3C2F2F, #4E342E)`, transition: 'transform 2.5s cubic-bezier(0.77, 0, 0.175, 1)' };
    return ( <div className="w-full h-screen bg-black overflow-hidden" style={{ perspective: '1500px' }}> <div className={`relative w-full h-full transition-transform duration-1000 ease-in-out ${isOpen ? 'scale-150' : ''}`} style={{ transformStyle: 'preserve-3d' }}> <div className={`absolute inset-0 transition-opacity duration-500 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}> <LibraryView shelves={shelves} user={user} onAddShelf={onAddShelf} onDeleteShelf={onDeleteShelf} db={db} auth={auth} /> </div> <div onClick={handleToggleCabinet} className={`absolute inset-0 flex items-center justify-center cursor-pointer z-20 transition-opacity duration-1000 ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}> <div className="text-center"> <h1 className="text-4xl md:text-6xl text-white font-bold tracking-widest" style={{ fontFamily: titleFont, textShadow: '0 0 15px rgba(255,223,186,0.5)' }}>The Library</h1> <p className="text-white/70 mt-4 tracking-[0.2em] animate-pulse">Click to Enter</p> </div> </div> <div className="absolute top-0 left-0 w-1/2 h-full p-8 flex flex-col justify-between border-r-2 border-black origin-left shadow-2xl" style={{ ...doorStyle, transform: isOpen ? 'rotateY(-130deg)' : 'rotateY(0deg)' }}> <div className="h-1/4 w-full border-4 border-transparent p-2" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}></div><div className="h-1/3 w-full border-4 border-transparent p-2 relative" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}><div className="absolute top-1/2 -right-6 -translate-y-1/2 w-4 h-16 rounded-full" style={{background: 'linear-gradient(145deg, #b08d57, #8a6e45)'}}></div></div><div className="h-1/4 w-full border-4 border-transparent p-2" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}></div> </div> <div className="absolute top-0 right-0 w-1/2 h-full p-8 flex flex-col justify-between border-l-2 border-black origin-right shadow-2xl" style={{ ...doorStyle, transform: isOpen ? 'rotateY(130deg)' : 'rotateY(0deg)' }}> <div className="h-1/4 w-full border-4 border-transparent p-2" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}></div><div className="h-1/3 w-full border-4 border-transparent p-2 relative" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}><div className="absolute top-1/2 -left-6 -translate-y-1/2 w-4 h-16 rounded-full" style={{background: 'linear-gradient(145deg, #b08d57, #8a6e45)'}}></div></div><div className="h-1/4 w-full border-4 border-transparent p-2" style={{borderImage: 'linear-gradient(145deg, #b08d57, #8a6e45) 1'}}></div> </div> </div> </div> );
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

    if (isLoading) { return <div className="min-h-screen flex items-center justify-center bg-black text-white">Loading Library...</div>; }
    if (!user) { return <AuthComponent auth={auth} />; }
    
    return <LibraryWrapper shelves={shelves} user={user} onAddShelf={handleAddShelf} onDeleteShelf={handleDeleteShelf} db={db} auth={auth} />;
}
