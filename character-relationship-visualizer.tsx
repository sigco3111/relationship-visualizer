import React, { useState, useRef, useEffect } from 'react';
import { Search, Users, Edit, Plus, Trash2, Save } from 'lucide-react';

const CharacterRelationshipVisualizer = () => {
  const [inputType, setInputType] = useState('title');
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newCharacter, setNewCharacter] = useState({ name: '', role: 'main', description: '' });
  const [newRelationship, setNewRelationship] = useState({ from: '', to: '', type: 'friend', description: '' });
  
  const svgRef = useRef();
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [draggedNode, setDraggedNode] = useState(null);

  // 색상 매핑
  const roleColors = {
    main: '#ff6b6b',      // 주인공 - 빨강
    support: '#4ecdc4',   // 조연 - 청록
    villain: '#45b7d1',   // 악역 - 파랑
    minor: '#96ceb4'      // 단역 - 연두
  };

  const relationshipTypes = {
    family: { color: '#e74c3c', label: '가족' },
    lover: { color: '#e91e63', label: '연인' },
    friend: { color: '#2ecc71', label: '친구' },
    enemy: { color: '#9b59b6', label: '적대' },
    colleague: { color: '#f39c12', label: '동료' },
    mentor: { color: '#34495e', label: '스승' }
  };

  // AI를 통한 인물 관계 분석
  const analyzeContent = async () => {
    setIsAnalyzing(true);
    try {
      const input = inputType === 'title' ? titleInput : contentInput;
      const prompt = inputType === 'title' 
        ? `"${input}"라는 작품의 주요 인물들과 그들 간의 관계를 분석해주세요.`
        : `다음 내용의 주요 인물들과 그들 간의 관계를 분석해주세요: ${input}`;

      const fullPrompt = `${prompt}

반드시 다음 JSON 형식으로만 응답해주세요. 다른 설명이나 텍스트는 절대 포함하지 마세요:

{
  "characters": [
    {
      "name": "인물명",
      "role": "main",
      "description": "인물 설명"
    }
  ],
  "relationships": [
    {
      "from": "인물1",
      "to": "인물2", 
      "type": "friend",
      "description": "관계 설명"
    }
  ]
}

역할(role)은 반드시 main, support, villain, minor 중 하나여야 합니다.
관계 유형(type)은 반드시 family, lover, friend, enemy, colleague, mentor 중 하나여야 합니다.
JSON 형식만 출력하고 다른 텍스트는 일절 포함하지 마세요.`;

      const response = await window.claude.complete(fullPrompt);
      
      // JSON 추출 시도
      let cleanedResponse = response.trim();
      
      // 백틱이나 코드 블록 마크업 제거
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // 첫 번째와 마지막 중괄호 사이의 내용만 추출
      const firstBrace = cleanedResponse.indexOf('{');
      const lastBrace = cleanedResponse.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedResponse = cleanedResponse.substring(firstBrace, lastBrace + 1);
      }
      
      let data;
      try {
        data = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('JSON 파싱 실패:', parseError);
        console.log('응답 내용:', response);
        
        // 기본값으로 대체
        data = {
          characters: [
            { name: "주인공", role: "main", description: "작품의 주인공" },
            { name: "조연", role: "support", description: "주인공을 돕는 인물" }
          ],
          relationships: [
            { from: "주인공", to: "조연", type: "friend", description: "친구 관계" }
          ]
        };
        alert('AI 분석 중 오류가 발생했습니다. 기본 예시로 시작합니다. 편집 모드에서 수정해주세요.');
      }
      
      setCharacters(data.characters || []);
      setRelationships(data.relationships || []);
      createVisualization(data.characters || [], data.relationships || []);
      
    } catch (error) {
      console.error('분석 오류:', error);
      
      // 오류 발생 시 기본 데이터 제공
      const defaultData = {
        characters: [
          { name: "주인공", role: "main", description: "작품의 주인공" },
          { name: "조연", role: "support", description: "주인공을 돕는 인물" },
          { name: "악역", role: "villain", description: "주인공과 대립하는 인물" }
        ],
        relationships: [
          { from: "주인공", to: "조연", type: "friend", description: "친구 관계" },
          { from: "주인공", to: "악역", type: "enemy", description: "적대 관계" }
        ]
      };
      
      setCharacters(defaultData.characters);
      setRelationships(defaultData.relationships);
      createVisualization(defaultData.characters, defaultData.relationships);
      
      alert('분석 중 오류가 발생했습니다. 기본 예시로 시작합니다. 편집 모드에서 원하는 인물과 관계를 추가해주세요.');
    }
    setIsAnalyzing(false);
  };

  // 시각화 생성
  const createVisualization = (chars, rels) => {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // 노드 생성 (원형 배치)
    const nodeData = chars.map((char, index) => {
      const angle = (index * 2 * Math.PI) / chars.length;
      const radius = Math.min(width, height) * 0.25;
      return {
        id: char.name,
        name: char.name,
        role: char.role,
        description: char.description,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        color: roleColors[char.role] || roleColors.minor
      };
    });

    // 링크 생성
    const linkData = rels.map(rel => ({
      source: rel.from,
      target: rel.to,
      type: rel.type,
      description: rel.description,
      color: relationshipTypes[rel.type]?.color || '#95a5a6'
    }));

    setNodes(nodeData);
    setLinks(linkData);
  };



  // 드래그 기능
  const handleMouseDown = (e, node) => {
    setDraggedNode(node);
  };

  const handleMouseMove = (e) => {
    if (!draggedNode) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setNodes(prev => prev.map(n => 
      n.id === draggedNode.id ? { ...n, x, y } : n
    ));
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  // 인물 추가
  const addCharacter = () => {
    if (!newCharacter.name) return;
    const newChar = { ...newCharacter };
    setCharacters(prev => [...prev, newChar]);
    createVisualization([...characters, newChar], relationships);
    setNewCharacter({ name: '', role: 'main', description: '' });
  };

  // 관계 추가
  const addRelationship = () => {
    if (!newRelationship.from || !newRelationship.to) return;
    const newRel = { ...newRelationship };
    setRelationships(prev => [...prev, newRel]);
    createVisualization(characters, [...relationships, newRel]);
    setNewRelationship({ from: '', to: '', type: 'friend', description: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            <Users className="text-indigo-600" />
            창작물 인물 관계도 시각화
          </h1>
          <p className="text-gray-600">소설, 드라마, 영화, 게임의 인물 관계를 한눈에 파악하세요</p>
        </div>

        {/* 입력 섹션 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setInputType('title')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                inputType === 'title' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              작품 제목으로 분석
            </button>
            <button
              onClick={() => setInputType('content')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                inputType === 'content' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              내용 직접 입력
            </button>
          </div>

          {inputType === 'title' ? (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="작품 제목을 입력하세요 (예: 해리포터, 어벤져스, 킹덤)"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                placeholder="작품의 줄거리나 인물 관계를 자세히 입력하세요..."
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                rows={6}
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          <button
            onClick={analyzeContent}
            disabled={isAnalyzing || (!titleInput && !contentInput)}
            className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 px-6 rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                분석 중...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                인물 관계 분석하기
              </>
            )}
          </button>
        </div>

        {/* 시각화 및 편집 섹션 */}
        {characters.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 관계도 시각화 */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">인물 관계도</h2>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    {isEditing ? '편집 완료' : '편집'}
                  </button>
                </div>

                {/* 범례 */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">인물 역할</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(roleColors).map(([role, color]) => (
                          <div key={role} className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                            <span className="text-sm text-gray-600">
                              {role === 'main' ? '주인공' : role === 'support' ? '조연' : role === 'villain' ? '악역' : '단역'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">관계 유형</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(relationshipTypes).map(([type, { color, label }]) => (
                          <div key={type} className="flex items-center gap-1">
                            <div className="w-3 h-1" style={{ backgroundColor: color }}></div>
                            <span className="text-sm text-gray-600">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SVG 시각화 */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <svg
                    ref={svgRef}
                    width="100%"
                    height="600"
                    viewBox="0 0 800 600"
                    className="bg-gray-50"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                  >
                    {/* 관계선 */}
                    {links.map((link, index) => {
                      const sourceNode = nodes.find(n => n.id === link.source);
                      const targetNode = nodes.find(n => n.id === link.target);
                      if (!sourceNode || !targetNode) return null;

                      return (
                        <g key={index}>
                          <line
                            x1={sourceNode.x}
                            y1={sourceNode.y}
                            x2={targetNode.x}
                            y2={targetNode.y}
                            stroke={link.color}
                            strokeWidth="3"
                            opacity="0.7"
                          />
                          <text
                            x={(sourceNode.x + targetNode.x) / 2}
                            y={(sourceNode.y + targetNode.y) / 2}
                            textAnchor="middle"
                            className="text-xs fill-gray-600"
                            dy="-5"
                          >
                            {relationshipTypes[link.type]?.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* 인물 노드 */}
                    {nodes.map((node, index) => (
                      <g key={index}>
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="40"
                          fill={node.color}
                          stroke="white"
                          strokeWidth="3"
                          className="cursor-pointer shadow-lg"
                          onMouseDown={(e) => handleMouseDown(e, node)}
                          onClick={() => setSelectedNode(node)}
                        />
                        <text
                          x={node.x}
                          y={node.y}
                          textAnchor="middle"
                          className="text-sm font-bold fill-white pointer-events-none"
                          dy="4"
                        >
                          {node.name}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            </div>

            {/* 사이드 패널 */}
            <div className="space-y-6">
              {/* 인물 정보 */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">인물 정보</h3>
                {selectedNode ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-800">{selectedNode.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{selectedNode.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.color }}></div>
                        <span className="text-sm text-gray-600">
                          {selectedNode.role === 'main' ? '주인공' : 
                           selectedNode.role === 'support' ? '조연' : 
                           selectedNode.role === 'villain' ? '악역' : '단역'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">인물을 클릭하여 정보를 확인하세요</p>
                )}
              </div>

              {/* 편집 도구 */}
              {isEditing && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">편집 도구</h3>
                  
                  {/* 인물 추가 */}
                  <div className="space-y-3 mb-6">
                    <h4 className="font-medium text-gray-700">인물 추가</h4>
                    <input
                      type="text"
                      placeholder="인물명"
                      value={newCharacter.name}
                      onChange={(e) => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    />
                    <select
                      value={newCharacter.role}
                      onChange={(e) => setNewCharacter(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="main">주인공</option>
                      <option value="support">조연</option>
                      <option value="villain">악역</option>
                      <option value="minor">단역</option>
                    </select>
                    <input
                      type="text"
                      placeholder="설명"
                      value={newCharacter.description}
                      onChange={(e) => setNewCharacter(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={addCharacter}
                      className="w-full bg-indigo-600 text-white py-2 rounded text-sm hover:bg-indigo-700 transition-colors"
                    >
                      인물 추가
                    </button>
                  </div>

                  {/* 관계 추가 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">관계 추가</h4>
                    <select
                      value={newRelationship.from}
                      onChange={(e) => setNewRelationship(prev => ({ ...prev, from: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="">인물 선택</option>
                      {characters.map(char => (
                        <option key={char.name} value={char.name}>{char.name}</option>
                      ))}
                    </select>
                    <select
                      value={newRelationship.to}
                      onChange={(e) => setNewRelationship(prev => ({ ...prev, to: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="">인물 선택</option>
                      {characters.map(char => (
                        <option key={char.name} value={char.name}>{char.name}</option>
                      ))}
                    </select>
                    <select
                      value={newRelationship.type}
                      onChange={(e) => setNewRelationship(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    >
                      {Object.entries(relationshipTypes).map(([type, { label }]) => (
                        <option key={type} value={type}>{label}</option>
                      ))}
                    </select>
                    <button
                      onClick={addRelationship}
                      className="w-full bg-green-600 text-white py-2 rounded text-sm hover:bg-green-700 transition-colors"
                    >
                      관계 추가
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterRelationshipVisualizer;