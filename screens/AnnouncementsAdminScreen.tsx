import React, { useState, useRef } from 'react';
import Layout from '../components/Layout';
import { useAnnouncements } from '../AnnouncementContext';

const AnnouncementsAdminScreen: React.FC = () => {
    const { announcements, addAnnouncement, updateAnnouncement, deleteAnnouncement, refreshAnnouncements } = useAnnouncements();
    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        image_url: '',
        active: true
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setFormData({ title: '', message: '', image_url: '', active: true });
        setIsEditing(false);
        setCurrentId(null);
    };

    const handleEdit = (announcement: any) => {
        setFormData({
            title: announcement.title,
            message: announcement.message,
            image_url: announcement.image_url,
            active: announcement.active === 1 || announcement.active === true
        });
        setCurrentId(announcement.id);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de eliminar este anuncio?')) {
            await deleteAnnouncement(id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing && currentId) {
            await updateAnnouncement(currentId, formData);
        } else {
            await addAnnouncement(formData);
        }
        resetForm();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 800 * 1024) {
                alert('La imagen es muy pesada. Máximo 800KB.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, image_url: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Layout title="Gestión de Anuncios">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Form Section */}
                <div className="bg-surface-dark rounded-2xl border border-border-dark p-6 shadow-xl">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">campaign</span>
                        {isEditing ? 'Editar Anuncio' : 'Crear Nuevo Anuncio'}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-text-secondary tracking-widest">Título</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-[#111822] border border-border-dark rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Ej: Reunión Especial de Jóvenes"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-text-secondary tracking-widest">Imagen (Opcional)</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-4 py-2 bg-[#111822] border border-border-dark rounded-xl text-text-secondary hover:text-white transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">image</span>
                                        Seleccionar Imagen
                                    </button>
                                    {formData.image_url && (
                                        <div className="relative group w-12 h-12">
                                            <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, image_url: '' })}
                                                className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <span className="material-symbols-outlined text-white text-[12px]">close</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-text-secondary tracking-widest">Mensaje</label>
                            <textarea
                                value={formData.message}
                                onChange={e => setFormData({ ...formData, message: e.target.value })}
                                className="w-full bg-[#111822] border border-border-dark rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none h-32 resize-none"
                                placeholder="Escribe el contenido del anuncio..."
                                required
                            />
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-border-dark/30">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.active ? 'bg-primary' : 'bg-border-dark'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formData.active ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.active}
                                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                    className="hidden"
                                />
                                <span className="text-sm font-medium text-text-secondary group-hover:text-white transition-colors">Activo (Visible)</span>
                            </label>

                            <div className="flex gap-3">
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-6 py-2 text-text-secondary hover:text-white transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="px-8 py-2 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
                                >
                                    {isEditing ? 'Guardar Cambios' : 'Publicar Anuncio'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* List Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {announcements.map((ann) => (
                        <div key={ann.id} className={`group relative bg-surface-dark rounded-2xl border ${ann.active ? 'border-border-dark' : 'border-red-900/30 bg-red-900/5'} overflow-hidden transition-all hover:shadow-2xl hover:border-primary/30`}>
                            {ann.image_url && (
                                <div className="h-48 w-full overflow-hidden">
                                    <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                </div>
                            )}
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-bold text-white line-clamp-1">{ann.title}</h3>
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${ann.active ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-500'}`}>
                                        {ann.active ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                </div>
                                <p className="text-text-secondary text-sm mb-6 line-clamp-3">{ann.message}</p>
                                <div className="flex justify-between items-center text-xs text-text-secondary opacity-60">
                                    <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                                </div>

                                {/* Actions Overlay */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEdit(ann)}
                                        className="p-2 bg-surface node-dark text-white rounded-lg shadow-lg hover:bg-primary transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ann.id)}
                                        className="p-2 bg-surface-dark text-white rounded-lg shadow-lg hover:bg-red-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {announcements.length === 0 && (
                        <div className="col-span-full py-12 text-center text-text-secondary">
                            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">campaign</span>
                            <p>No hay anuncios creados aún.</p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default AnnouncementsAdminScreen;
