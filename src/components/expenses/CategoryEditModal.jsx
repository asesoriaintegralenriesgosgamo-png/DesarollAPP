import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CATEGORY_ICONS, CATEGORY_COLORS, renderCategoryIcon } from './CategoryIcons';

export default function CategoryEditModal({ category, isOpen, onClose, onSave, isSaving }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setIcon(category.icon || '');
      setColor(category.color || '');
    }
  }, [category]);

  if (!isOpen || !category) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, icon, color });
  };

  return (
    <Modal title="Editar Categoría" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nombre</label>
          <input 
            type="text" 
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-white border border-stone-300 text-stone-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Color</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-stone-900 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">Icono</label>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-60 overflow-y-auto p-2 bg-stone-50 rounded-lg border border-stone-200">
            {Object.keys(CATEGORY_ICONS).map(iconKey => (
              <button
                key={iconKey}
                type="button"
                onClick={() => setIcon(iconKey)}
                className={`p-2 rounded-lg flex items-center justify-center transition-colors ${icon === iconKey ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-stone-200'}`}
                title={iconKey}
              >
                {renderCategoryIcon(iconKey, icon === iconKey ? color || '#3b82f6' : '#57534e', 'w-6 h-6')}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-200 flex justify-end gap-2">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            disabled={isSaving || !name.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
