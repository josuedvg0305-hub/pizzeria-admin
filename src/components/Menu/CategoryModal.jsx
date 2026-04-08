import { useState } from 'react'
import Modal from '../shared/Modal'
import { useMenu } from '../../context/MenuContext'

export default function CategoryModal({ onClose }) {
  const { addCategory } = useMenu()
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    addCategory({ name: name.trim() })
    onClose()
  }

  return (
    <Modal title="Nueva categoría" onClose={onClose} size="sm">
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
