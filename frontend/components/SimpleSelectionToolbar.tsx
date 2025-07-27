'use client';

import React, { useState, useEffect } from 'react';

export function SimpleSelectionToolbar() {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    const checkSelection = (e: MouseEvent | KeyboardEvent) => {
      console.log('SimpleSelectionToolbar: checkSelection called');
      const selection = window.getSelection();
      const text = selection?.toString() || '';
      
      console.log('SimpleSelectionToolbar: text =', text, 'length =', text.length);
      
      if (text.trim()) {
        console.log('Simple selection detected:', text);
        setSelectedText(text);
        setShow(true);
        
        // 获取鼠标位置
        const mouseX = e instanceof MouseEvent ? e.clientX : 100;
        const mouseY = e instanceof MouseEvent ? e.clientY : 100;
        setPosition({ x: mouseX + 10, y: mouseY + 10 });
      } else {
        setShow(false);
      }
    };

    // 简单的全局监听
    window.addEventListener('mouseup', checkSelection);
    window.addEventListener('keyup', checkSelection);
    
    return () => {
      window.removeEventListener('mouseup', checkSelection);
      window.removeEventListener('keyup', checkSelection);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x + 'px',
        top: position.y + 'px',
        background: 'white',
        border: '1px solid #ccc',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 99999,
      }}
    >
      <div>选中了: {selectedText.substring(0, 30)}...</div>
      <button onClick={() => alert('改写: ' + selectedText)}>改写</button>
      <button onClick={() => alert('续写: ' + selectedText)}>续写</button>
    </div>
  );
}