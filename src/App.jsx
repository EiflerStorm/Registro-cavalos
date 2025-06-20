import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { supabase } from './supabaseClient';
import { v4 as uuidv4 } from 'uuid';

// Main App Component
function App() {
  const [horses, setHorses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('list');
  const [selectedHorseId, setSelectedHorseId] = useState(null);
  const [isSharedView, setIsSharedView] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  const fetchHorses = async () => {
    setLoading(true);
    setError(null);
    try {
      let { data, error } = await supabase
        .from('cavalos')
        .select('id, created_at, nome, raca, url_imagem, pai_id, mae_id, idade, sexo');

      if (error) {
        throw error;
      }
      setHorses(data);
    } catch (err) {
      console.error('Erro ao buscar cavalos:', err.message);
      setError('Falha ao carregar cavalos. Verifique sua conexão ou configurações do Supabase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHorses();

    const params = new URLSearchParams(window.location.search);
    const horseIdParam = params.get('id');
    const sharedParam = params.get('shared');

    if (horseIdParam) {
      setSelectedHorseId(decodeURIComponent(horseIdParam));
      setViewMode('details');
      if (sharedParam === 'true') {
        setIsSharedView(true);
      }
    } else {
      setViewMode('list');
      setIsSharedView(false);
    }
  }, []);

  const goToHorseDetails = (id) => {
    setSelectedHorseId(id);
    setViewMode('details');
    setIsSharedView(false);
  };

  // Função para adicionar um novo cavalo no Supabase
  // Agora recebe `fatherId` e `motherId` diretamente
  const addHorse = async (newHorseData) => {
    setLoading(true);
    setError(null);
    try {
      let photoUrl = null;
      // 1. Upload da imagem para o Supabase Storage
      if (newHorseData.photoFile) {
        const fileExtension = newHorseData.photoFile.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExtension}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('fotos-cavalos')
          .upload(filePath, newHorseData.photoFile);

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('fotos-cavalos')
          .getPublicUrl(filePath);

        if (publicUrlData && publicUrlData.publicUrl) {
          photoUrl = publicUrlData.publicUrl;
        } else {
          throw new Error('Não foi possível obter o URL público da imagem após o upload.');
        }
      }

      // 2. Inserir os dados do cavalo no Supabase Database
      const { data, error: insertError } = await supabase
        .from('cavalos')
        .insert([
          {
            nome: newHorseData.name,
            raca: newHorseData.breed,
            idade: newHorseData.age, // Coluna 'idade' no DB
            sexo: newHorseData.sex, // Coluna 'sexo' no DB
            pai_id: newHorseData.fatherId, // Recebido diretamente como ID ou null
            mae_id: newHorseData.motherId, // Recebido diretamente como ID ou null
            url_imagem: photoUrl,
          }
        ])
        .select();

      if (insertError) {
        throw insertError;
      }

      setHorses(prevHorses => [...prevHorses, data[0]]);
      setViewMode('list');
      alert('Cavalo adicionado com sucesso!');
    } catch (err) {
      console.error('Erro ao adicionar cavalo ou fazer upload da imagem:', err.message);
      setError(`Falha ao adicionar cavalo: ${err.message}`);
      alert(`Falha ao adicionar cavalo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  let content;
  if (loading) {
    content = <div className="text-center p-6 text-gray-600">Carregando cavalos...</div>;
  } else if (error) {
    content = <div className="text-center p-6 bg-red-100 text-red-700 rounded-lg shadow-md"><p>{error}</p><button onClick={fetchHorses} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">Tentar Novamente</button></div>;
  } else {
    switch (viewMode) {
      case 'list':
        content = (
          <HorseList
            horses={horses}
            onSelectHorse={goToHorseDetails}
            onAddHorse={() => setViewMode('add')}
          />
        );
        break;
      case 'details':
        const horse = horses.find(h => h.id === selectedHorseId);
        content = horse ? (
          <HorseDetail
            horse={horse}
            horses={horses}
            onBack={() => {
              setViewMode('list');
              setIsSharedView(false);
            }}
            onViewLineage={() => setViewMode('lineageTree')}
            isSharedView={isSharedView}
            setShareMessage={setShareMessage}
            shareMessage={shareMessage}
          />
        ) : (
          <div className="text-center p-6 bg-red-100 text-red-700 rounded-lg shadow-md">
            <p className="text-xl font-semibold mb-4">Cavalo não encontrado.</p>
            <button
              onClick={() => setViewMode('list')}
              className="mt-4 px-6 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition duration-300 shadow-md"
            >
              Voltar para a lista
            </button>
          </div>
        );
        break;
      case 'add':
        // PASSA A LISTA DE CAVALOS PARA O FORMULÁRIO AQUI
        content = <HorseForm horses={horses} onAddHorse={addHorse} onCancel={() => setViewMode('list')} />;
        break;
      case 'lineageTree':
        const rootHorse = horses.find(h => h.id === selectedHorseId);
        content = (
          <LineageTreeD3
            rootHorse={rootHorse}
            horses={horses}
            onSelectHorse={goToHorseDetails}
            onBack={() => setViewMode('details')}
          />
        );
        break;
      default:
        content = (
          <HorseList
            horses={horses}
            onSelectHorse={goToHorseDetails}
            onAddHorse={() => setViewMode('add')}
          />
        );
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 font-sans text-gray-800 p-4 sm:p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-green-800 tracking-tight">
          Sistema de Pedigree Equino
        </h1>
      </div>
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-200">
        {content}
      </div>
    </div>
  );
}

// --- Componente da Lista de Cavalos (ajustado para nomes do DB) ---
function HorseList({ horses, onSelectHorse, onAddHorse }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-700">Cavalos Cadastrados</h2>
        <button
          onClick={onAddHorse}
          className="px-6 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300 transform hover:scale-105"
        >
          + Adicionar Cavalo
        </button>
      </div>

      {horses.length === 0 ? (
        <p className="text-center text-gray-500 text-lg py-8">Nenhum cavalo cadastrado ainda. Adicione um para começar!</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {horses.sort((a, b) => a.nome.localeCompare(b.nome)).map((horse) => (
            <li
              key={horse.id}
              className="bg-green-50 p-4 rounded-lg shadow-sm hover:shadow-md transition duration-200 cursor-pointer border border-green-200 flex items-center gap-4"
              onClick={() => onSelectHorse(horse.id)} // Passa o ID, não o nome
            >
              <img
                src={horse.url_imagem || 'https://placehold.co/60x60/cccccc/white?text=Sem+Foto'} // Usa 'url_imagem'
                alt={`Foto de ${horse.nome}`}
                className="w-16 h-16 object-cover rounded-full border-2 border-green-400 flex-shrink-0"
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/60x60/cccccc/white?text=Sem+Foto'; }}
              />
              <div>
                <span className="text-lg font-semibold text-green-700 block">{horse.nome}</span>
                <span className="text-sm text-gray-600">{horse.raca}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Componente de Detalhes do Cavalo (ajustado para nomes do DB e resolução de pais) ---
function HorseDetail({ horse, horses, onBack, onViewLineage, isSharedView, setShareMessage, shareMessage }) {

  // Funções helper para obter nomes dos pais a partir dos IDs
  const getParentName = (parentId) => {
    const parent = horses.find(h => h.id === parentId);
    return parent ? parent.nome : null;
  };

  const handleShareClick = () => {
    // Agora compartilha por ID, não por nome
    const shareUrl = `${window.location.origin}/?id=${encodeURIComponent(horse.id)}&shared=true`;
    fallbackCopyTextToClipboard(shareUrl);
  };

  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setShareMessage('Link copiado para a área de transferência!');
      setTimeout(() => setShareMessage(''), 3000);
    } catch (err) {
      console.error('Falha ao copiar o link (fallback): ', err);
      setShareMessage('Não foi possível copiar o link automaticamente. Por favor, copie-o manualmente: ' + text);
      setTimeout(() => setShareMessage(''), 5000);
    }
    document.body.removeChild(textArea);
  }

  // Resolvendo os nomes dos pais para exibição
  const fatherName = getParentName(horse.pai_id);
  const motherName = getParentName(horse.mae_id);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-green-100">
      <div className="flex justify-center mb-6">
        <img
          src={horse.url_imagem || 'https://placehold.co/600x400/cccccc/white?text=Sem+Foto'} // Usa 'url_imagem'
          alt={`Foto de ${horse.nome}`}
          className="w-[600px] h-[400px] object-cover border-8 border-green-500 shadow-md rounded-lg"
          onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/600x400/cccccc/white?text=Sem+Foto'; }}
        />
      </div>

      <h2 className="text-3xl font-bold text-green-800 mb-6 text-center">{horse.nome}</h2>

      <div className="space-y-4 text-lg">
        <p><strong className="text-gray-700">Raça:</strong> <span className="text-gray-800">{horse.raca}</span></p>
        <p><strong className="text-gray-700">Idade:</strong> <span className="text-gray-800">{horse.idade} anos</span></p> {/* Assumindo 'age' existe no DB ou é calculado */}
        <p><strong className="text-gray-700">Sexo:</strong> <span className="text-gray-800">{horse.sexo}</span></p>

        <div className="pt-4 border-t border-gray-200 mt-4">
          <p className="mb-2">
            <strong className="text-gray-700">Pai:</strong>{' '}
            {fatherName ? (
              <span className="text-gray-800 font-medium">
                {fatherName}
              </span>
            ) : (
              <span className="text-gray-600 italic">Não Registrado</span>
            )}
          </p>
          <p>
            <strong className="text-gray-700">Mãe:</strong>{' '}
            {motherName ? (
              <span className="text-gray-800 font-medium">
                {motherName}
              </span>
            ) : (
              <span className="text-gray-600 italic">Não Registrada</span>
            )}
          </p>
          {((horse.pai_id && !fatherName) || (horse.mae_id && !motherName)) ? (
            <p className="text-sm text-red-500 mt-2">
              (Alguns parentes estão registados por ID, mas sem detalhes completos no sistema.)
            </p>
          ) : null}
        </div>
      </div>

      {shareMessage && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-lg text-center font-semibold animate-fadeInOut">
          {shareMessage}
        </div>
      )}

      {!isSharedView && (
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button
            onClick={onViewLineage}
            className="flex-1 px-6 py-3 bg-green-700 text-white rounded-lg shadow-lg hover:bg-green-800 transition duration-300 transform hover:scale-105 text-lg"
          >
            Ver Árvore Genealógica
          </button>
          <button
            onClick={handleShareClick}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 transition duration-300 transform hover:scale-105 text-lg"
          >
            Partilhar Página
          </button>
          <button
            onClick={onBack}
            className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 transition duration-300 transform hover:scale-105 text-lg"
          >
            &larr; Voltar para a lista
          </button>
        </div>
      )}
    </div>
  );
}

// --- Componente do Formulário do Cavalo ---
// AGORA RECEBE 'horses' como prop
function HorseForm({ horses, onAddHorse, onCancel }) {
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  // Agora armazena o ID do pai/mãe selecionado (ou null/string vazia)
  const [fatherId, setFatherId] = useState('');
  const [motherId, setMotherId] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setPreviewPhoto(null);
      alert('Por favor, selecione um ficheiro de imagem válido.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !breed || !age || !sex) {
      alert('Por favor, preencha todos os campos obrigatórios (Nome, Raça, Idade, Sexo).');
      return;
    }

    onAddHorse({
      name: capitalizeEachWord(name),
      breed: capitalizeEachWord(breed),
      age: parseInt(age),
      sex: capitalizeEachWord(sex),
      fatherId: fatherId === '' ? null : fatherId, // Passa o ID ou null
      motherId: motherId === '' ? null : motherId, // Passa o ID ou null
      birthDate: birthDate || null,
      photoFile: selectedFile
    });

    setName(''); setBreed(''); setAge(''); setSex('');
    setFatherId(''); setMotherId('');
    setSelectedFile(null); setPreviewPhoto(null); setBirthDate('');
  };

  const capitalizeEachWord = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s|\/|-|'|")(\p{L})/gu, (match) => match.toUpperCase());
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-green-200">
      <h2 className="text-3xl font-bold text-green-700 mb-6 text-center">Cadastrar Novo Cavalo</h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-gray-700 font-semibold mb-2">Nome:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 transition duration-200"
            required
          />
        </div>
        <div>
          <label htmlFor="breed" className="block text-gray-700 font-semibold mb-2">Raça:</label>
          <input
            type="text"
            id="breed"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 transition duration-200"
            required
          />
        </div>
        <div>
          <label htmlFor="age" className="block text-gray-700 font-semibold mb-2">Idade (anos):</label>
          <input
            type="number"
            id="age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 transition duration-200"
            min="0"
            required
          />
        </div>
        <div>
          <label htmlFor="sex" className="block text-gray-700 font-semibold mb-2">Sexo (Macho/Fêmea):</label>
          <select
            id="sex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 transition duration-200"
            required
          >
            <option value="">Selecione</option>
            <option value="Macho">Macho</option>
            <option value="Fêmea">Fêmea</option>
          </select>
        </div>
        <div>
          <label htmlFor="photoUpload" className="block text-gray-700 font-semibold mb-2">Carregar Foto (Opcional):</label>
          <input
            type="file"
            id="photoUpload"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full text-gray-700 text-sm file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0 file:text-sm file:font-semibold
            file:bg-green-100 file:text-green-700 hover:file:bg-green-200"
          />
          {previewPhoto && (
            <div className="mt-4 flex justify-center">
              <img
                src={previewPhoto}
                alt="Pré-visualização da foto"
                className="w-32 h-32 object-cover rounded-lg border-2 border-green-400 shadow-md"
              />
            </div>
          )}
        </div>
        <div className="border-t border-gray-200 pt-5 mt-5">
          <h3 className="text-xl font-bold text-gray-700 mb-4">Parentesco (Opcional)</h3>
          <div>
            <label htmlFor="fatherId" className="block text-gray-700 font-semibold mb-2">Pai:</label>
            <select
              id="fatherId"
              value={fatherId}
              onChange={(e) => setFatherId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 transition duration-200"
            >
              <option value="">Não Registrado</option>
              {horses.filter(h => h.sexo === 'Macho').sort((a, b) => a.nome.localeCompare(b.nome)).map(horse => (
                <option key={horse.id} value={horse.id}>
                  {horse.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <label htmlFor="motherId" className="block text-gray-700 font-semibold mb-2">Mãe:</label>
            <select
              id="motherId"
              value={motherId}
              onChange={(e) => setMotherId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-green-500 transition duration-200"
            >
              <option value="">Não Registrada</option>
              {horses.filter(h => h.sexo === 'Fêmea').sort((a, b) => a.nome.localeCompare(b.nome)).map(horse => (
                <option key={horse.id} value={horse.id}>
                  {horse.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-green-700 text-white rounded-lg shadow-lg hover:bg-green-800 transition duration-300 transform hover:scale-105 text-lg font-semibold"
          >
            Salvar Cavalo
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg shadow-lg hover:bg-gray-600 transition duration-300 transform hover:scale-105 text-lg font-semibold"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// Helper function to build data structure for D3 ancestry tree
const buildD3AncestryData = (horse, allHorses, maxDepth, currentDepth = 0) => {
  if (!horse || currentDepth >= maxDepth) {
    return null;
  }

  const node = {
    id: horse.id,
    name: horse.nome,
    breed: horse.raca,
    age: horse.idade, // Usa 'idade' do DB
    sex: horse.sexo, // Usa 'sexo' do DB
    photoUrl: horse.url_imagem,
    children: [],
  };

  if (currentDepth < maxDepth - 1) {
    const father = horse.pai_id ? allHorses.find(h => h.id === horse.pai_id) : null;
    const mother = horse.mae_id ? allHorses.find(h => h.id === horse.mae_id) : null;

    if (father) {
      node.children.push(buildD3AncestryData(father, allHorses, maxDepth, currentDepth + 1));
    }
    if (mother) {
      node.children.push(buildD3AncestryData(mother, allHorses, maxDepth, currentDepth + 1));
    }
    node.children = node.children.filter(child => child !== null);
  }

  return node;
};

// Componente da Árvore Genealógica (usando D3.js)
function LineageTreeD3({ rootHorse, horses, onSelectHorse, onBack }) {
  const svgRef = useRef();
  const maxGeneration = 5;

  useEffect(() => {
    if (!rootHorse) return;

    const margin = { top: 60, right: 120, bottom: 60, left: 120 };
    const width = 1200 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .call(zoomBehavior);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const treeData = buildD3AncestryData(rootHorse, horses, maxGeneration);
    if (!treeData) {
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("fill", "gray")
        .text("Cavalo raiz não encontrado ou sem ancestrais para exibir.");
      return;
    }

    const root = d3.hierarchy(treeData);

    const treeLayout = d3.tree()
      .nodeSize([100, 200]);

    treeLayout(root);

    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x))
      .attr('fill', 'none')
      .attr('stroke', '#A3A3A3')
      .attr('stroke-width', 1.5);

    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .on('click', (event, d) => {
        event.stopPropagation();
        onSelectHorse(d.data.id); // Passa o ID, não o nome
      })
      .attr('cursor', 'pointer');

    nodes.append('rect')
      .attr('x', -70)
      .attr('y', -45)
      .attr('width', 140)
      .attr('height', 100)
      .attr('fill', 'white')
      .attr('stroke', '#84CC16')
      .attr('stroke-width', 1)
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('class', 'shadow-sm');

    nodes.append('image')
      .attr('xlink:href', d => d.data.photoUrl || 'https://placehold.co/60x60/cccccc/white?text=Foto')
      .attr('x', -30)
      .attr('y', -40)
      .attr('width', 60)
      .attr('height', 60)
      .style('border-radius', '50%')
      .attr('class', 'object-cover border-2 border-green-400');

    nodes.append('text')
      .attr('y', 30)
      .attr('x', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#166534')
      .text(d => d.data.name);

    nodes.append('text')
      .attr('y', 45)
      .attr('x', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#4B5563')
      .text(d => d.data.breed);

  }, [rootHorse, horses, onSelectHorse, maxGeneration]);

  if (!rootHorse) {
    return (
      <div className="text-center p-6 bg-red-100 text-red-700 rounded-lg shadow-md">
        <p className="text-xl font-semibold mb-4">Cavalo raiz não encontrado para a árvore genealógica.</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition duration-300 shadow-md"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-green-100">
      <h2 className="text-3xl font-bold text-green-700 mb-6 text-center">
        Árvore Genealógica de {rootHorse.name}
      </h2>
      <div className="overflow-hidden" style={{ maxHeight: '70vh', width: '100%' }}>
        <svg ref={svgRef} className="block mx-auto" style={{ width: '100%', height: '100%' }}></svg>
      </div>
      <button
        onClick={onBack}
        className="mt-8 px-6 py-3 bg-gray-600 text-white rounded-lg shadow-lg hover:bg-gray-700 transition duration-300 transform hover:scale-105 w-full text-lg"
      >
        &larr; Voltar
      </button>
    </div>
  );
}

// Export the main App component as default
export default App;