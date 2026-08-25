import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4'>
      <div className='max-w-md w-full text-center'>
        <div className='mb-8'>
          <h1 className='text-9xl font-bold text-gray-200'>404</h1>
          <h2 className='text-3xl font-bold text-gray-900 mt-4'>Página no encontrada</h2>
          <p className='mt-2 text-gray-600'>La página que buscas no existe o fue movida.</p>
        </div>

        <div className='space-y-3'>
          <button
            onClick={() => navigate(-1)}
            className='w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium'
          >
            ← Volver atrás
          </button>
          <button
            onClick={() => navigate('/')}
            className='w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium'
          >
            Ir a inicio
          </button>
        </div>
      </div>
    </div>
  )
}
