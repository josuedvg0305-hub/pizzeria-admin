import { useState } from 'react'
import Modal from '../shared/Modal'
import { useMenu } from '../../context/MenuContext'

export default function CategoryModal({ category, onClose }) {
  const { addCategory, updateCategory } = useMenu()
  const isEdit = !!category
  const [name, setName] = useState(category?.name || '')

  if (isEdit && (!category || Object.keys(category).length === 0)) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    isEdit ? updateCategory(category.id, { name: name.trim() }) : addCategory({ name: name.trim() })
    onClose()
  }

  return (
    <Modal title={isEdit ? `Editar: ${category?.name}` : "Nueva categoría"} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Nombre <span className="req">*</span></label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Pizzas, Bebidas, Postres…"
            autoFocus
            required
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Crear</button>
        </div>
      </form>
    </Modal>
  )
}
