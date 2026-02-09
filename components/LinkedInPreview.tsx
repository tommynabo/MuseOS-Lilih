import React from 'react';
import { X, ThumbsUp, MessageSquare, Share2, Send, MoreHorizontal, Globe } from 'lucide-react';
import { ContentPiece } from '../types';

interface LinkedInPreviewProps {
    post: ContentPiece;
    isOpen: boolean;
    onClose: () => void;
    authorName?: string;
    authorAvatar?: string;
    authorHeadline?: string;
}

const LinkedInPreview: React.FC<LinkedInPreviewProps> = ({
    post,
    isOpen,
    onClose,
    authorName = "Tu Nombre",
    authorAvatar = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
    authorHeadline = "Experto en tu Nicho | Ayudando a profesionales"
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#f3f2ef] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header Modal */}
                <div className="bg-white px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-gray-900 font-semibold text-sm">Vista Previa del Post</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* LinkedIn Feed Post Lookalike */}
                <div className="p-4 overflow-y-auto max-h-[80vh]">
                    <div className="bg-white rounded-lg border border-gray-300 shadow-sm">

                        {/* Post Header */}
                        <div className="p-3 flex gap-3">
                            <img src={authorAvatar} alt={authorName} className="w-12 h-12 rounded-full object-cover" />
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold text-sm text-gray-900 leading-tight hover:text-blue-600 hover:underline cursor-pointer">
                                            {authorName}
                                        </h4>
                                        <p className="text-xs text-gray-500 line-clamp-1">{authorHeadline}</p>
                                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                            <span>Just now</span>
                                            <span>•</span>
                                            <Globe size={10} />
                                        </div>
                                    </div>
                                    <button className="text-gray-500 hover:bg-gray-100 p-1 rounded-full">
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Post Content */}
                        <div className="px-4 py-2">
                            {/* Hook is typically bold in preview or just first line */}
                            <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                                {post.generatedDraft.body || post.generatedDraft.hook}
                            </div>
                        </div>

                        {/* Engagement Counts (Fake) */}
                        <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 mx-4">
                            <div className="flex items-center gap-1">
                                <div className="flex -space-x-1">
                                    <div className="bg-blue-500 rounded-full p-0.5"><ThumbsUp size={8} className="text-white fill-current" /></div>
                                    <div className="bg-red-400 rounded-full p-0.5"><span className="text-[6px] text-white">❤️</span></div>
                                </div>
                                <span>12</span>
                            </div>
                            <span>2 comments</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="px-2 py-1 flex justify-between items-center">
                            <ActionBtn icon={ThumbsUp} label="Like" />
                            <ActionBtn icon={MessageSquare} label="Comment" />
                            <ActionBtn icon={Share2} label="Repost" />
                            <ActionBtn icon={Send} label="Send" />
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

const ActionBtn = ({ icon: Icon, label }: { icon: any, label: string }) => (
    <button className="flex items-center gap-1.5 px-3 py-3 hover:bg-gray-100 rounded-lg text-gray-500 font-semibold text-sm flex-1 justify-center transition-colors">
        <Icon size={18} />
        <span className="text-xs sm:text-sm">{label}</span>
    </button>
);

export default LinkedInPreview;
