// In src/App.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    bookColors: ['#795548', '#607D8B', '#424242', '#3E2723', '#BF360C', '#0D47A1', '#004D40', '#33691E', '#F57F17', '#C2185B'],
    // New colors for tags
    tagColors: ['#3E2723', '#BF360C', '#0D47A1', '#004D40', '#33691E', '#F57F17', '#C2185B', '#4A148C', '#880E4F', '#B71C1C']
};
const bodyFont = "'Lato', sans-serif";
const titleFont = "'Playfair Display', serif";
const spineFont = "'DM Serif Display', serif";

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
    // UPDATED with Tags
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

    const handleTagInput = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const newTag = currentTag.trim();
            if (newTag && !tags.includes(newTag)) {
                setTags([...tags, newTag]);
            }
            setCurrentTag('');
        }
    };
    const removeTag = (tagToRemove) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const uploadToCloudinary = async (file) => { /* ... same */ };
    const handleGenerateImage = async () => { /* ... same */ };

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
                    id: crypto.randomUUID(), title, author, pages: parseInt(pages, 10), description, tags,
                    createdAt: new Date().toISOString(), ...coverData
                })
            });
            onClose();
        } catch (error) { console.error("Error adding book:", error); alert(`Failed to add book: ${error.message}`); }
        finally { setIsSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" style={{ fontFamily: bodyFont }}>
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6" style={{ color: PALETTE.text, fontFamily: titleFont }}>Add a Book</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" placeholder="Book Title *" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-3 border rounded-md" />
                    <input type="text" placeholder="Author's Name *" value={author} onChange={e => setAuthor(e.target.value)} required className="w-full p-3 border rounded-md" />
                    <input type="number" placeholder="Total Pages *" value={pages} onChange={e => setPages(e.target.value)} required min="1" className="w-full p-3 border rounded-md" />
                    <textarea placeholder="Description or notes..." value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border rounded-md h-24 resize-y"></textarea>
                    
                    {/* NEW TAG INPUT */}
                    <div>
                        <label className="font-semibold block mb-2" style={{ color: PALETTE.text }}>Tags</label>
                        <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md">
                            {tags.map(tag => (
                                <div key={tag} className="flex items-center gap-1 bg-gray-200 text-gray-700 text-sm font-semibold px-2 py-1 rounded-full">
                                    <span>{tag}</span>
                                    <button type="button" onClick={() => removeTag(tag)} className="font-bold text-red-500 hover:text-red-700">&times;</button>
                                </div>
                            ))}
                            <input type="text" value={currentTag} onChange={(e) => setCurrentTag(e.target.value)} onKeyDown={handleTagInput} placeholder="Add a tag..." className="flex-grow bg-transparent focus:outline-none"/>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Press Enter or Comma (,) to add a tag.</p>
                    </div>

                    <div className="pt-2"> <label className="font-semibold block mb-2" style={{ color: PALETTE.text }}>Spine Color</label> <div className="flex flex-wrap gap-2"> {PALETTE.bookColors.map(color => (<button type="button" key={color} onClick={() => setSpineColor(color)} className={`w-8 h-8 rounded-full transition-transform transform hover:scale-110 ${spineColor === color ? 'ring-4 ring-offset-2' : ''}`} style={{ backgroundColor: color, borderColor: PALETTE.accent }}></button>))} </div> </div>
                    { /* Other form elements are the same... */ }
                    <div className="mt-8 flex justify-end gap-4"> <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-gray-200 font-semibold">Cancel</button> <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-md text-white font-semibold flex items-center justify-center" style={{backgroundColor: PALETTE.text}}>{isSubmitting ? <Spinner/> : 'Add Book'}</button> </div>
                </form>
            </div>
        </div>
    );
};

// Function to get a deterministic color for a tag
const getColorForTag = (tag) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PALETTE.tagColors[Math.abs(hash) % PALETTE.tagColors.length];
};

const BookSpine = ({ book, onClick }) => { /* ... same as before */ };

const BookDetailModal = ({ book, onClose, onRemove }) => {
    // UPDATED with Tags display
    const [isFlipped, setIsFlipped] = useState(false);
    useEffect(() => { const timer = setTimeout(() => setIsFlipped(true), 100); return () => clearTimeout(timer); }, []);
    const handleBackgroundClick = (e) => { if (e.target === e.currentTarget) onClose(); };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-40" onClick={handleBackgroundClick} style={{ perspective: '2000px', fontFamily: bodyFont }}>
            <div className={`relative w-full max-w-4xl h-[90vh] max-h-[600px] transition-transform duration-1000`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : '' }}>
                {/* Back side (details) */}
                <div className="absolute w-full h-full bg-white shadow-2xl rounded-lg flex flex-col md:flex-row overflow-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <div className="w-full md:w-1/3 h-1/3 md:h-full flex-shrink-0" style={{ backgroundColor: book.coverColor, backgroundImage: `url(${book.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                    <div className="p-6 md:p-8 flex flex-col flex-grow overflow-y-auto min-h-0">
                        <h2 className="text-3xl font-bold" style={{color: PALETTE.text, fontFamily: titleFont}}>{book.title}</h2>
                        <h3 className="text-xl text-gray-500 mb-4" style={{fontFamily: titleFont}}>by {book.author || 'Unknown'}</h3>
                        <p className="text-gray-500 mb-6 flex-shrink-0">Pages: {book.pages}</p>
                        
                        {/* TAGS DISPLAY */}
                        {book.tags && book.tags.length > 0 && (
                            <div className="mb-6 flex flex-wrap gap-2">
                                {book.tags.map(tag => (
                                    <span key={tag} className="text-white text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: getColorForTag(tag) }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="text-gray-700 space-y-4 flex-grow"><h3 className="font-bold text-lg" style={{color: PALETTE.text}}>Description</h3><p className="whitespace-pre-wrap">{book.description || "No description."}</p></div>
                        <button onClick={onRemove} className="mt-6 self-start px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 flex-shrink-0">Remove</button>
                    </div>
                </div>
                {/* Front side (cover) */}
                <div className="absolute w-full h-full bg-gray-300 shadow-2xl rounded-lg" style={{ backfaceVisibility: 'hidden', backgroundColor: book.coverColor, backgroundImage: `url(${book.coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
            </div>
        </div>
    );
};

const LibraryView = ({ shelves, user, onAddShelf, onDeleteShelf, db, auth }) => {
    // UPDATED with Search state and logic
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
        shelves.forEach(shelf => {
            shelf.books?.forEach(book => {
                const inTitle = book.title?.toLowerCase().includes(lowercasedQuery);
                const inAuthor = book.author?.toLowerCase().includes(lowercasedQuery);
                const inDescription = book.description?.toLowerCase().includes(lowercasedQuery);
                const inTags = book.tags?.some(tag => tag.toLowerCase().includes(lowercasedQuery));

                if (inTitle || inAuthor || inDescription || inTags) {
                    results.push({ ...book, shelfName: shelf.name, shelfId: shelf.id });
                }
            });
        });
        return results;
    }, [searchQuery, shelves]);

    const handleOpenBook = (book) => {
        setViewedBook(book);
        setSearchQuery('');
    };

    // Other handlers remain the same...

    return (
        <div className="min-h-screen w-full p-4 sm:p-6 lg:p-8" style={{ background: PALETTE.background, fontFamily: bodyFont }}>
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-6 md:mb-10">
                    {/* SEARCH BAR */}
                    <div className="w-1/3 relative">
                        <input
                            type="text"
                            placeholder="Search books..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full max-w-sm p-2 pl-8 border rounded-full bg-white/80"
                        />
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        {searchQuery && (
                            <div className="absolute top-full mt-2 w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden z-10">
                                {searchResults.length > 0 ? (
                                    <ul>{searchResults.slice(0, 10).map(book => (
                                        <li key={book.id} onClick={() => handleOpenBook(book)} className="p-3 hover:bg-gray-100 cursor-pointer border-b">
                                            <p className="font-bold">{book.title}</p>
                                            <p className="text-sm text-gray-600">by {book.author} on "{book.shelfName}"</p>
                                        </li>
                                    ))}</ul>
                                ) : (<p className="p-3 text-sm text-gray-500">No results found.</p>)}
                            </div>
                        )}
                    </div>
                    <h1 className="text-xl sm:text-4xl md:text-5xl font-extrabold text-center" style={{ color: PALETTE.text, fontFamily: titleFont }}>{user.displayName ? `${user.displayName}'s Library` : "My Library"}</h1>
                    <div className="w-1/3 flex justify-end">
                      <button onClick={() => signOut(auth)} className="flex items-center justify-center bg-red-500 text-white hover:bg-red-700 transition-colors p-2 md:px-4 md:py-2 rounded-full md:rounded-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>
                        <span className="hidden md:inline ml-2">Logout</span>
                      </button>
                    </div>
                </header>
                {/* The rest of the LibraryView is the same... */}
                {viewedBook && ( <BookDetailModal book={viewedBook} onClose={() => setViewedBook(null)} onRemove={() => {}} /> )}
            </div>
        </div>
    );
};

export default function App() {
    // This component remains mostly the same, just loads one more font
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

    // Other useEffect and handlers are the same...
};
