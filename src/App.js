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
    background: '#F5F5F5', wood: '#6D4C41', shelf: '#A1887F', text: '#4E342E', accent: '#D8A7B1',
    shadow: 'rgba(0, 0, 0, 0.2)',
    bookColors: ['#795548', '#607D8B', '#424242', '#3E2723', '#BF360C', '#0D47A1', '#004D40', '#33691E', '#F57F17', '#C2185B']
};
const bodyFont = "'Lato', sans-serif";
const titleFont = "'Playfair Display', serif";
const spineFont = "'DM Serif Display', serif";

// --- Helper Components ---
const Spinner = () => <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>;

// --- Auth Component ---
const AuthComponent = ({ auth }) => {
    // This component remains the same from your version
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

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: PALETTE.background, fontFamily: bodyFont }}>
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-xl border-t-4" style={{borderColor: PALETTE.wood}}>
                <h2 className="text-3xl font-bold text-center" style={{ color: PALETTE.text, fontFamily: titleFont }}>{isLogin ? 'Welcome to the Library' : 'Build Your Bookshelf'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (<input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your Name" required className="w-full px-4 py-2 border rounded-md" />)}
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required className="w-full px-4 py-2 border rounded-md" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required className="w-full px-4 py-2 border rounded-md" />
                    <button type="submit" disabled={loading} className="w-full px-4 py-3 font-semibold text-white rounded-md flex items-center justify-center" style={{backgroundColor: PALETTE.text}}>{loading ? <Spinner /> : (isLogin ? 'Enter Library' : 'Create Library')}</button>
                </form>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button onClick={() => setIsLogin(!isLogin)} className="w-full text-sm text-center" style={{color: PALETTE.text}}>{isLogin ? "Need a new library card? Sign Up" : "Already have a card? Login"}</button>
            </div>
        </div>
    );
};

// --- Library Components ---

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, shelfName }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl p-6 md:p-8 w-full max-w-md text-center" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold mb-4" style={{ color: PALETTE.text, fontFamily: titleFont }}>Delete Shelf?</h2>
                <p className="mb-6" style={{ fontFamily: bodyFont, color: '#424242' }}>Are you sure you want to permanently delete the shelf named <strong className="font-bold">"{shelfName}"</strong> and all of its books?</p>
                <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
                <div className="flex justify-center gap-4">
                    <button onClick={onClose} className="px-6 py-2 rounded-md bg-gray-200 hover:bg-gray-300 font-semibold" style={{color: PALETTE.text}}>Cancel</button>
                    <button onClick={onConfirm} className="px-6 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700">Delete</button>
                </div>
            </div>
        </div>
    );
};

const AddBookModal = ({ shelfId, onClose, db, userId }) => {
    // This component remains the same
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [pages, setPages] = useState('');
    const [description, setDescription] = useState('');
    const [coverType, setCoverType] = useState('color');
    const [coverColor, setCoverColor] = useState(PALETTE.bookColors[0]);
    const [spineColor, setSpineColor] = useState(PALETTE.bookColors[1]);
    const [coverFile, setCoverFile] = useState(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatedImage, setGeneratedImage] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.REACT_APP_HUGGINGFACE_API_KEY}` },
                body: JSON.stringify({ inputs: aiPrompt }),
            });
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
            await updateDoc(shelfRef, {
                books: arrayUnion({
                    id: crypto.randomUUID(), title, author, pages: parseInt(pages, 10), description,
                    createdAt: new Date().toISOString(), ...coverData
                })
            });
            onClose();
        } catch (error) { console.error("Error adding book:", error); alert(`Failed to add book: ${error.message}`); }
        finally { setIsSubmitting(false); }
    };

    return ( <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ fontFamily: bodyFont }}> <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"> <h2 className="text-2xl font-bold mb-6" style={{ color: PALETTE.text, fontFamily: titleFont }}>Add a Book</h2> <form onSubmit={handleSubmit} className="space-y-4"> <input type="text" placeholder="Book Title *" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-3 border rounded-md" /> <input type="text" placeholder="Author's Name *" value={author} onChange={e => setAuthor(e.target.value)} required className="w-full p-3 border rounded-md" /> <input type="number" placeholder="Total Pages *" value={pages} onChange={e => setPages(e.target.value)} required min="1" className="w-full p-3 border rounded-md" /> <textarea placeholder="Description or notes..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border rounded-md h-24 resize-y"></textarea> <div className="pt-2"> <label className="font-semibold block mb-2" style={{ color: PALETTE.text }}>Spine Color</label> <div className="flex flex-wrap gap-2"> {PALETTE.bookColors.map(color => (<button type="button" key={color} onClick={() => setSpineColor(color)} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${spineColor === color ? 'ring-4 ring-offset-2' : ''}`} style={{ backgroundColor: color, borderColor: PALETTE.accent }}></button>))} </div> </div> <div className="space-y-3 pt-2"> <label className="font-semibold" style={{ color: PALETTE.text }}>Cover Style (for front cover)</label> <div className="flex gap-4"> {['color', 'upload', 'ai'].map(type => (<button type="button" key={type} onClick={() => setCoverType(type)} className={`px-3 py-1 rounded-md text-sm capitalize transition-colors ${coverType === type ? 'text-white' : 'bg-gray-200'}`} style={{backgroundColor: coverType === type ? PALETTE.text : '#eee'}}>{type}</button>))} </div> {coverType === 'color' && ( <div className="pt-2"><label className="text-sm block mb-2">Front Cover Color:</label><div className="flex flex-wrap gap-2">{PALETTE.bookColors.map(color => (<button type="button" key={color} onClick={() => setCoverColor(color)} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${coverColor === color ? 'ring-4 ring-offset-2' : ''}`} style={{ backgroundColor: color, borderColor: PALETTE.accent }}></button>))}</div></div> )} {coverType === 'upload' && ( <input type="file" onChange={e => setCoverFile(e.target.files[0])} accept="image/*" className="w-full text-sm mt-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0" /> )} {coverType === 'ai' && ( <div className="space-y-3 pt-2"><textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe the cover..." className="w-full p-2 border rounded-md"></textarea><button type="button" onClick={handleGenerateImage} disabled={isGenerating || !aiPrompt} className="px-4 py-2 bg-purple-600 text-white rounded-md flex items-center justify-center">{isGenerating ? <Spinner/> : "Generate"}</button>{generatedImage && <img src={generatedImage.url} alt="AI generated cover" className="w-32 h-44 object-cover rounded-md mt-2"/>}</div> )} </div> <div className="mt-8 flex justify-end gap-4"> <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 font-semibold">Cancel</button> <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-md text-white font-semibold flex items-center justify-center" style={{backgroundColor: PALETTE.text}}>{isSubmitting ? <Spinner/> : 'Add Book'}</button> </div> </form> </div> </div> );
};

const BookSpine = ({ book, onClick }) => {
    const thickness = useMemo(() => Math.max(20, Math.min(book.pages / 8, 50)), [book.pages]);
    const spineColor = book.spineColor || book.coverColor || '#A1887F';
    const randomHeightOffset = useMemo(() => Math.random() * 10 - 5, []);
    const titleLength = book.title.length;
    const fontSize = useMemo(() => {
        if (thickness < 25 && titleLength > 15) return '10px';
        if (titleLength > 25) return '11px';
        if (titleLength > 18) return '12px';
        return '14px';
    }, [thickness, titleLength]);

    return (
        <div className="group relative flex-shrink-0 h-[220px] cursor-pointer transform transition-transform duration-200 hover:-translate-y-2 mr-1" style={{ width: `${thickness}px`, marginTop: `${randomHeightOffset}px` }} onClick={onClick}>
            <div className="absolute top-0 left-[3px] w-full h-full bg-[#fdfaf5]" style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/lined-paper.png')`, boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.2)' }}></div>
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center" style={{ backgroundColor: spineColor, backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.25), transparent 10%, transparent 90%, rgba(0,0,0,0.25))`, boxShadow: '2px 0 5px rgba(0,0,0,0.3)' }}>
                <span className="text-white font-serif tracking-wider text-center overflow-hidden" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontFamily: spineFont, fontSize: fontSize, textShadow: '1px 1px 2px rgba(0,0,0,0.7)', padding: '10px 0', maxHeight: '100%' }}>{book.title}</span>
            </div>
        </div>
    );
};

// UPDATED BookDetailModal for scrolling
const BookDetailModal = ({ book, onClose, onRemove }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setIsFlipped(true), 100); return () => clearTimeout(timer); }, []);
    const handleBackgroundClick = (e) => { if (e.target === e.currentTarget) onClose(); };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-40" onClick={handleBackgroundClick} style={{ perspective: '2000px', fontFamily: bodyFont }}>
            <div className={`relative w-full max-w-4xl h-[90vh] max-h-[600px] transition-transform duration-1000`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : '' }}>
                {/* Back side (details) */}
                <div className="absolute w-full h-full bg-white shadow-2xl rounded-lg flex flex-col md:flex-row overflow-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <div className="w-full md:w-1/3 h-1/3 md:h-full flex-shrink-0" style={{ backgroundColor: book.coverColor, backgroundImage: `url(${book.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                    {/* This div is now the scrolling container */}
                    <div className="p-6 md:p-8 flex flex-col flex-grow overflow-y-auto min-h-0">
                        <h2 className="text-3xl font-bold" style={{color: PALETTE.text, fontFamily: titleFont}}>{book.title}</h2>
                        <h3 className="text-xl text-gray-500 mb-4" style={{fontFamily: titleFont}}>by {book.author || 'Unknown Author'}</h3>
                        <p className="text-gray-500 mb-6 flex-shrink-0">Pages: {book.pages}</p>
                        <div className="text-gray-700 space-y-4 flex-grow"><h3 className="font-bold text-lg" style={{color: PALETTE.text}}>Description</h3><p className="whitespace-pre-wrap">{book.description || "No description provided."}</p></div>
                        <button onClick={onRemove} className="mt-6 self-start px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex-shrink-0">Remove from Shelf</button>
                    </div>
                </div>
                {/* Front side (cover) */}
                <div className="absolute w-full h-full bg-gray-300 shadow-2xl rounded-lg" style={{ backfaceVisibility: 'hidden', backgroundColor: book.coverColor, backgroundImage: `url(${book.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                     <div className="flex items-center justify-center h-full text-white text-3xl font-bold p-4 text-center" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.7)', fontFamily: titleFont}}>{!book.coverImageUrl && book.title}</div>
                </div>
            </div>
        </div>
    );
};

// UPDATED LibraryView with responsive logout button
const LibraryView = ({ shelves, user, onAddShelf, onDeleteShelf, db, auth }) => {
    const [newShelfName, setNewShelfName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
    const [selectedShelfIdForBook, setSelectedShelfIdForBook] = useState(null);
    const [viewedBook, setViewedBook] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [shelfToDelete, setShelfToDelete] = useState(null);

    const handleAddShelf = async (e) => { e.preventDefault(); if (!newShelfName.trim() || isAdding) return; setIsAdding(true); await onAddShelf(newShelfName); setNewShelfName(''); setIsAdding(false); };
    const handleOpenAddBook = (shelfId) => { setSelectedShelfIdForBook(shelfId); setIsAddBookModalOpen(true); };
    const handleRemoveBook = async () => { if (!viewedBook || !viewedBook.shelfId) return; const shelf = shelves.find(s => s.id === viewedBook.shelfId); const bookToRemove = shelf?.books.find(b => b.id === viewedBook.id); if (!bookToRemove) return; try { const shelfRef = doc(db, `users/${user.uid}/shelves`, viewedBook.shelfId); await updateDoc(shelfRef, { books: arrayRemove(bookToRemove) }); setViewedBook(null); } catch (error) { console.error("Error removing book:", error); } };
    const handleOpenDeleteModal = (shelf) => { setShelfToDelete(shelf); setIsDeleteModalOpen(true); };
    const handleConfirmDelete = () => { if (shelfToDelete) { onDeleteShelf(shelfToDelete.id); } setIsDeleteModalOpen(false); setShelfToDelete(null); };

    return (
        <div className="min-h-screen w-full p-4 sm:p-6 lg:p-8" style={{ background: PALETTE.background, fontFamily: bodyFont }}>
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-10">
                    <div className="w-10 md:w-24"></div>
                    <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-center" style={{ color: PALETTE.text, fontFamily: titleFont }}>{user.displayName ? `${user.displayName}'s Library` : "My Library"}</h1>
                    <div className="w-10 md:w-24 flex justify-end">
                      <button onClick={() => signOut(auth)} className="flex items-center justify-center bg-red-500 text-white hover:bg-red-700 transition-colors p-2 md:px-4 md:py-2 rounded-full md:rounded-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>
                        <span className="hidden md:inline ml-2">Logout</span>
                      </button>
                    </div>
                </header>
                <div className="max-w-xl mx-auto mb-12 p-4 bg-white/70 rounded-lg shadow-md">
                    <form onSubmit={handleAddShelf} className="flex gap-2">
                        <input type="text" value={newShelfName} onChange={e => setNewShelfName(e.target.value)} placeholder="Name a new collection..." className="flex-grow p-3 border rounded-md" />
                        <button type="submit" disabled={isAdding} className="px-6 py-3 text-white font-semibold rounded-md flex items-center justify-center" style={{backgroundColor: PALETTE.text}}>{isAdding ? <Spinner/> : 'Create'}</button>
                    </form>
                </div>
                <div className="space-y-12">
                    {shelves.map(shelf => (
                        <div key={shelf.id}>
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-2xl font-bold" style={{ color: PALETTE.text, fontFamily: titleFont }}>{shelf.name}</h2>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleOpenDeleteModal(shelf)} className="w-8 h-8 flex items-center justify-center bg-red-600 rounded-full text-white hover:bg-red-700 transition-colors" title="Delete shelf"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                                    <button onClick={() => handleOpenAddBook(shelf.id)} className="px-3 py-1 text-white text-sm font-semibold rounded-md" style={{backgroundColor: PALETTE.accent}}>+ Add Book</button>
                                </div>
                            </div>
                            <div className="relative pt-4 pb-2" style={{ backgroundColor: '#424242', backgroundImage: `url('https://www.transparenttextures.com/patterns/dark-wood.png')`, boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 6px 10px -5px rgba(0,0,0,0.7)'}}>
                                <div className="flex items-end gap-1 overflow-x-auto px-4 min-h-[230px]">
                                    {(shelf.books || []).map(book => <BookSpine key={book.id} book={book} onClick={() => setViewedBook({...book, shelfId: shelf.id})} />)}
                                    {(shelf.books || []).length === 0 && ( <p className="text-center w-full self-center" style={{color: 'rgba(255,255,255,0.5)'}}>This shelf is empty.</p> )}
                                </div>
                                <div className="h-4" style={{backgroundColor: PALETTE.shelf, boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.4)'}}></div>
                            </div>
                        </div>
                    ))}
                </div>
                {isAddBookModalOpen && ( <AddBookModal shelfId={selectedShelfIdForBook} onClose={() => setIsAddBookModalOpen(false)} db={db} userId={user.uid} /> )}
                {viewedBook && ( <BookDetailModal book={viewedBook} onClose={() => setViewedBook(null)} onRemove={handleRemoveBook} /> )}
                <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleConfirmDelete} shelfName={shelfToDelete?.name} />
            </div>
        </div>
    );
};

export default function App() {
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [shelves, setShelves] = useState([]);

    useEffect(() => {
        const fontLink = document.createElement('link');
        fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Lato:wght@400;700&family=Playfair+Display:wght@700&display=swap";
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
        } catch (error) {
            console.error("Error deleting shelf:", error);
            alert("Failed to delete shelf.");
        }
    };

    if (isLoading) { return <div className="min-h-screen flex items-center justify-center">Loading...</div>; }
    if (!user) { return <AuthComponent auth={auth} />; }
    return <LibraryView shelves={shelves} user={user} onAddShelf={handleAddShelf} onDeleteShelf={handleDeleteShelf} db={db} auth={auth} />;
}