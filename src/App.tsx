import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Box,
  Typography,
  Tooltip,
  Skeleton
} from '@mui/material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import UploadIcon from '@mui/icons-material/Upload';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Autocomplete from '@mui/material/Autocomplete';

import * as XLSX from 'xlsx';
import { DeductionItem, Student, RegisteredDeduction, AllData, CheckBoxState, RegisteredDeductionTree } from './types/all_type';

function App() {
  const [allData, setAllData] = useState<AllData>({
    totalPoints: 100,
    deductionItemTree: {
      id: 'root',
      description: 'チェックリスト',
      points: 100,
      defaultFeedback: '採点ができない',
      subDeductions: []
    },
    studentList: []
  });
  // deductionId -> DeductionItemのmap
  const [deductionIdToItemMap, setDeductionIdToItemMap] = useState<Map<string, DeductionItem>>(new Map());
  // deductionId -> アクセスパスのmap
  /**
   * path: その減点項目を、deductionItemTreeの根からたどるためのパス
   * 例えば、
   * 
   * "1" --- "1-1"
   *      |
   *      |- "1-2"
   *      |    |
   *      |    |- "1-2-1"
   *      |    |
   *      |    |- "1-2-2"
   *      |
   *      |- "1-3"
   * 
   * の場合、
   * 
   * "1" -> []
   * "1-1" -> [0]
   * "1-2" -> [1]
   * "1-2-1" -> [1, 0]
   * "1-2-2" -> [1, 1]
   * "1-3" -> [2]
   * 
   * となる。
   * 講評を生成するときに必要
   */
  const [deductionIdToPathMap, setDeductionIdToPathMap] = useState<Map<string, number[]>>(new Map());

  // 選択中の学生のID
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // 学生追加用コンポーネント
  const [openStudentDialog, setOpenStudentDialog] = useState(false);
  const [newStudent, setNewStudent] = useState({
    studentId: '',
    name: ''
  });

  // 減点項目追加用のダイアログの状態
  const [openDeductionDialog, setOpenDeductionDialog] = useState(false);
  const [newDeduction, setNewDeduction] = useState<{
    parentPath: number[];
    description: string;
    points: number;
    defaultFeedback: string;
  }>({
    parentPath: [],
    description: '',
    points: 0,
    defaultFeedback: ''
  });

  // 減点項目編集用のstate追加
  const [editingDeduction, setEditingDeduction] = useState<DeductionItem | null>(null);

  // 全データ削除用の確認ダイアログの状態
  const [openDeleteAllDialog, setOpenDeleteAllDialog] = useState(false);

  // 減点項目削除用の確認ダイアログの状態
  const [openDeleteDeductionDialog, setOpenDeleteDeductionDialog] = useState(false);

  // 削除する減点項目のIDを保持するstate
  const [deletingDeductionId, setDeletingDeductionId] = useState<string>('');

  // DeductionItemTreeからMapを構築する再帰的な関数
  const buildDeductionMap = (item: DeductionItem, map: Map<string, DeductionItem>) => {
    map.set(item.id, item);
    item.subDeductions.forEach(subItem => {
      buildDeductionMap(subItem, map);
    });
  };

  const buildDeductionIdToPathMap = (item: DeductionItem, map: Map<string, number[]>, currentPath: number[]) => {
    map.set(item.id, currentPath);
    item.subDeductions.forEach((subItem, index) => {
      buildDeductionIdToPathMap(subItem, map, [...currentPath, index]);
    });
  };

  const updateMaps = () => {
    const initialDeductionIdToItemMap = new Map();
    buildDeductionMap(allData.deductionItemTree, initialDeductionIdToItemMap);
    setDeductionIdToItemMap(initialDeductionIdToItemMap);

    const initialDeductionIdToPathMap = new Map();
    buildDeductionIdToPathMap(allData.deductionItemTree, initialDeductionIdToPathMap, []);
    setDeductionIdToPathMap(initialDeductionIdToPathMap);
  }

  // LocalStorageからデータを読む
  useEffect(() => {
    console.log('useEffect');
    const savedData = localStorage.getItem('dsa-grading-tool-data');
    if (savedData) {
      setAllData(JSON.parse(savedData));
    }

    updateMaps();
  }, []);

  // データを全て削除する関数
  const handleDeleteAllData = () => {
    // LocalStorageからデータを削除
    localStorage.removeItem('dsa-grading-tool-data');

    // stateを空にする
    setAllData({
      totalPoints: 100,
      deductionItemTree: {
        id: 'root',
        description: 'チェックリスト',
        points: 100,
        defaultFeedback: '採点ができない',
        subDeductions: []
      },
      studentList: []
    });
    setSelectedStudentId('');

    updateMaps();

    // ダイアログを閉じる
    setOpenDeleteAllDialog(false);
  };

  // 学生移動用の関数
  const moveToAdjacentStudent = (direction: 'prev' | 'next', scrollToTop: boolean = false) => {
    const currentIndex = allData.studentList.findIndex(s => s.id === selectedStudentId);
    if (currentIndex < 0 || currentIndex >= allData.studentList.length) return;

    if (direction === 'prev' && currentIndex > 0) {
      setSelectedStudentId(allData.studentList[currentIndex - 1].id);
    } else if (direction === 'next' && currentIndex < allData.studentList.length - 1) {
      setSelectedStudentId(allData.studentList[currentIndex + 1].id);
    }

    if (scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // スコアを計算する関数
  const calculateScore = (student: Student) => {
    const deductionTotal = student.registeredDeductionList.reduce((acc, regDeduction) => {
      const deductionItem = deductionIdToItemMap.get(regDeduction.deductionId);
      if (deductionItem) {
        return acc + deductionItem.points;
      }
      return acc;
    }, 0);
    return allData.totalPoints - deductionTotal - student.additionalDeduction;
  };

  const displayGeneratedFeedback = (student: Student) => {
    let feedback = '';

    // student.registeredDeductionListを、pathの辞書順でソートする
    // 例えば、("1" -> "1-1"), ("2" -> "2-1"), ("1-1" -> "1-1-1")なら、
    // ("1" -> "1-1"), ("1-1" -> "1-1-1"), ("2" -> "2-1")となる
    student.registeredDeductionList.sort((a, b) => {
      const aPath = deductionIdToPathMap.get(a.deductionId);
      const bPath = deductionIdToPathMap.get(b.deductionId);
      if (!aPath || !bPath) return 0;
      // path(number[])を、"%04d-%04d-%04d..."のように文字列に変換
      const aPathString = aPath.map(p => p.toString().padStart(4, '0')).join('-');
      const bPathString = bPath.map(p => p.toString().padStart(4, '0')).join('-');
      return aPathString < bPathString ? -1 : 1;
    });

    const renderedNodeSet = new Set();
    for (const regDeduction of student.registeredDeductionList) {
      const deductionItem = deductionIdToItemMap.get(regDeduction.deductionId);
      const path = deductionIdToPathMap.get(regDeduction.deductionId);
      if (!path || !deductionItem) continue;

      let currentNode: DeductionItem = allData.deductionItemTree;
      for (let i = 0; i < path.length - 1; ++i) {
        currentNode = currentNode.subDeductions[path[i]];
        if (renderedNodeSet.has(currentNode.id)) {
          continue;
        }
        const indent = '  '.repeat(i);
        feedback += `${indent}${currentNode.description}:\n`;
        renderedNodeSet.add(currentNode.id);
      }

      const indent = '  '.repeat(path.length - 1);
      feedback += `${indent}${regDeduction.feedback}(-${deductionItem.points}points)\n`;
    }

    // 自由記述フィードバックの追加
    if (feedback !== '') {
      feedback += '\n' + student.additionalFeedback;
    } else {
      feedback = student.additionalFeedback;
    }
    return feedback;
  }

  // スコア表示用のコンポーネント
  const ScoreDisplay = ({ student }: { student: Student }) => {
    const score = calculateScore(student);
    const lessThanZero = score < 0;

    return (
      <Typography
        variant="h5"
        component="span"
        sx={{
          color: lessThanZero ? 'error.main' : 'inherit',
          cursor: lessThanZero ? 'help' : 'inherit'
        }}
      >
        {lessThanZero ? (
          <Tooltip
            title="減点により0点未満になりましたが、0点として表示されています"
            arrow
          >
            <span>0 ({score.toFixed(2)})</span>
          </Tooltip>
        ) : (
          <span>{score.toFixed(2)}</span>
        )}
        {' / '}{allData.totalPoints.toFixed(2)}
      </Typography>
    );
  };

  // 学生追加用ダイアログを開く
  const handleOpenStudentDialog = () => {
    setOpenStudentDialog(true);
    setNewStudent({
      studentId: '',
      name: ''
    });
  };

  // 学生追加用ダイアログを閉じる
  const handleCloseStudentDialog = () => {
    setOpenStudentDialog(false);
  };

  // 学生を追加する
  const handleAddStudent = () => {
    if (!newStudent.studentId || !newStudent.name) return;

    const newStudentData: Student = {
      id: `student-${Date.now()}`,
      studentId: newStudent.studentId,
      name: newStudent.name,
      isSubmitted: true,
      isGraded: false,
      registeredDeductionList: [],
      additionalDeduction: 0,
      additionalFeedback: ''
    };
    const newStudents = [...allData.studentList, newStudentData];
    setAllData({
      ...allData,
      studentList: newStudents
    });
    localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));
    handleCloseStudentDialog();
  };

  // 選択中の学生を削除する
  const handleRemoveStudent = () => {
    if (!selectedStudentId) return;
    const newStudents = allData.studentList.filter(student => student.id !== selectedStudentId);
    setAllData({
      ...allData,
      studentList: newStudents
    });
    setSelectedStudentId('');
    localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));
  };

  // 減点項目の編集
  const handleEditDeduction = (item: DeductionItem) => {
    setEditingDeduction(item);
    const path = deductionIdToPathMap.get(item.id);
    if (!path) return;
    setNewDeduction({
      parentPath: path,
      description: item.description,
      points: item.points,
      defaultFeedback: item.defaultFeedback
    });
    setOpenDeductionDialog(true);
  };

  // 減点項目の削除
  const handleDeleteDeduction = (deductionId: string) => {
    const targetPath = deductionIdToPathMap.get(deductionId);
    if (!targetPath) return;

    // path = [0, 1, 2] の場合、
    // pathが[0, 1, 2,...]で始まる減点項目全て削除する
    // [0, 1, 2,...]で始まる減点項目のidリストをdeductionIdToPathMapから取得
    const targetIds = Array.from(deductionIdToPathMap.entries()).filter(([id, path]) => {
      return path.length >= targetPath.length && path.slice(0, targetPath.length).every((value, index) => value === targetPath[index]);
    }).map(([id, path]) => id);

    // DeductionItemTreeを更新する
    let newDeductionItemTree = allData.deductionItemTree;
    let currentNode = newDeductionItemTree;
    for (let i = 0; i < targetPath.length - 1; ++i) {
      currentNode = currentNode.subDeductions[targetPath[i]];
    }
    // currentNode.subDeductions[targetPath[targetPath.length - 1]]を削除
    currentNode.subDeductions = currentNode.subDeductions.filter(item => item.id !== deductionId);

    setAllData({
      ...allData,
      deductionItemTree: newDeductionItemTree
    });

    // 学生の採点項目からも削除
    const updatedStudents = allData.studentList.map(student => ({
      ...student,
      registeredDeductionList: student.registeredDeductionList.filter(regDeduction => !targetIds.includes(regDeduction.deductionId))
    }));
    setAllData({
      ...allData,
      studentList: updatedStudents
    });
    localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));

    // マップを更新
    updateMaps();
  };

  // 減点項目を追加または更新
  const handleAddOrUpdateDeduction = () => {
    if (!newDeduction.description || !newDeduction.points) return;

    if (editingDeduction) {
      // 編集モード
      const targetPath = deductionIdToPathMap.get(editingDeduction.id);
      if (!targetPath) return;

      let newDeductionItemTree = allData.deductionItemTree;
      let currentNode = newDeductionItemTree;
      for (let i = 0; i < targetPath.length - 1; ++i) {
        currentNode = currentNode.subDeductions[targetPath[i]];
      }
      currentNode.subDeductions[targetPath[targetPath.length - 1]] = {
        ...editingDeduction,
        description: newDeduction.description,
        points: newDeduction.points,
        defaultFeedback: newDeduction.defaultFeedback
      };

      setAllData({
        ...allData,
        deductionItemTree: newDeductionItemTree
      });
      localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));
    } else {
      // 新規追加モード
      const newItem: DeductionItem = {
        id: `deduction-${Date.now()}`,
        description: newDeduction.description,
        points: newDeduction.points,
        defaultFeedback: newDeduction.defaultFeedback,
        subDeductions: []
      };
      let deductionItemTree = allData.deductionItemTree;
      let currentNode = deductionItemTree;
      for (let i = 0; i < newDeduction.parentPath.length; ++i) {
        currentNode = currentNode.subDeductions[newDeduction.parentPath[i]];
      }
      currentNode.subDeductions.push(newItem);

      setAllData({
        ...allData,
        deductionItemTree: deductionItemTree
      });
      localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));

      // マップを更新
      updateMaps();
    }

    setOpenDeductionDialog(false);
    setEditingDeduction(null);
  };

  // subDeductionsの並び替え
  const moveDeductionItem = (targetPath: number[], direction: 'up' | 'down') => {
    const parentPath = targetPath.slice(0, targetPath.length - 1);

    let deductionItemTree = allData.deductionItemTree;
    let currentNode = deductionItemTree;
    for (let i = 0; i < parentPath.length; ++i) {
      currentNode = currentNode.subDeductions[parentPath[i]];
    }
    const subDeductionSize = currentNode.subDeductions.length;
    const targetIndex = targetPath[targetPath.length - 1];

    if (direction === 'up' && targetIndex > 0) {
      // 要素を上に移動
      [currentNode.subDeductions[targetIndex - 1], currentNode.subDeductions[targetIndex]] =
        [currentNode.subDeductions[targetIndex], currentNode.subDeductions[targetIndex - 1]];
    } else if (direction === 'down' && targetIndex < subDeductionSize - 1) {
      // 要素を下に移動
      [currentNode.subDeductions[targetIndex], currentNode.subDeductions[targetIndex + 1]] =
        [currentNode.subDeductions[targetIndex + 1], currentNode.subDeductions[targetIndex]];
    }

    setAllData({
      ...allData,
      deductionItemTree: deductionItemTree
    });
    localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));

    // マップを更新
    updateMaps();
  }

  // 減点項目のダイアログを閉じる
  const handleCloseDeductionDialog = () => {
    setOpenDeductionDialog(false);
    setEditingDeduction(null);
    setNewDeduction({
      parentPath: [],
      description: '',
      points: 0,
      defaultFeedback: ''
    });
  };

  // 減点項目のチェック状態を変更
  const handleDeductionToggle = (deductionId: string) => {
    const currentStudent = allData.studentList.find(s => s.id === selectedStudentId);
    if (!currentStudent) return;

    const deduction = deductionIdToItemMap.get(deductionId);
    if (!deduction) return;

    const newStudents = allData.studentList.map(student => {
      if (student.id !== selectedStudentId) return student;

      const hasDeduction = student.registeredDeductionList.some(regDeduction => regDeduction.deductionId === deductionId);
      let newDeductions: RegisteredDeduction[];

      if (hasDeduction) {
        // チェックを外す場合
        newDeductions = student.registeredDeductionList.filter(regDeduction => regDeduction.deductionId !== deductionId);
      } else {
        // チェックを入れる場合
        newDeductions = [...student.registeredDeductionList, { deductionId, feedback: deduction.defaultFeedback }];
      }

      return {
        ...student,
        registeredDeductionList: newDeductions
      };
    });

    setAllData({
      ...allData,
      studentList: newStudents
    });
    localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));

    // マップを更新
    updateMaps();
  }

  // 追加減点を更新する関数
  const handleAdditionalDeductionChange = (value: number) => {
    const newStudents = allData.studentList.map(student =>
      student.id === selectedStudentId
        ? { ...student, additionalDeduction: value }
        : student
    );
    setAllData({
      ...allData,
      studentList: newStudents
    });
    localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));
  };

  // 追加講評(自由記述)を更新する関数
  const handleAdditionalNotesChange = (value: string) => {
    const newStudents = allData.studentList.map(student =>
      student.id === selectedStudentId
        ? { ...student, additionalFeedback: value }
        : student
    );
    setAllData({
      ...allData,
      studentList: newStudents
    });
    localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));
  };

  // Excelファイルを読み込む
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      console.log(jsonData);

      // 1行目をスキップしたい場合は slice(1) を追加
      const newStudents = jsonData.map((row) => ({
        id: `student-${Date.now()}-${Math.random()}`,
        studentId: row[0]?.toString() || '',
        name: row[1]?.toString() || '',
        isSubmitted: true,
        isGraded: false,
        registeredDeductionList: [],
        additionalDeduction: 0,
        additionalFeedback: ''
      }));

      // 既存の学生リストと結合
      const updatedStudents = [...allData.studentList, ...newStudents];
      setAllData({
        ...allData,
        studentList: updatedStudents
      });
      localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));
    };
    reader.readAsArrayBuffer(file);
  }

  // 採点結果をエクスポート
  const handleExportResults = () => {
    // エクスポートするデータの作成
    const exportData = allData.studentList.map(student => ({
      '学籍番号': student.studentId,
      '氏名': student.name,
      '得点': Math.max(calculateScore(student), 0),
      '講評': displayGeneratedFeedback(student).trim()
    }));

    // ワークブックとワークシートの作成
    const workBook = XLSX.utils.book_new();
    const workSheet = XLSX.utils.json_to_sheet(exportData);

    // 列幅の設定
    const columnWidths = [
      { wch: 10 }, // 学籍番号
      { wch: 15 }, // 氏名
      { wch: 8 }, // 得点
      { wch: 50 } // 講評
    ];
    workSheet['!cols'] = columnWidths;

    // ワークブックにワークシートを追加
    XLSX.utils.book_append_sheet(workBook, workSheet, '採点結果');

    // ファイルとして保存
    const fileName = `採点結果_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workBook, fileName);
  };

  // このシステムの内部データ(deductionItems, students)を保存
  const handleSaveData = () => {
    const saveData = allData;

    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grading-data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // このシステムの内部データを読み込む
  const handleLoadData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        setAllData(data);
        localStorage.setItem('dsa-grading-tool-data', JSON.stringify(data));
      } catch (error) {
        console.error('Invalid JSON file', error);
        alert('無効なJSONファイルです');
      }
    };
    reader.readAsText(file);
  };

  // 減点項目リストをインポートする
  const handleImportDeductions = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        setAllData({
          ...allData,
          deductionItemTree: data
        });
        localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));
        // マップを更新
        updateMaps();
      } catch (error) {
        console.error('Invalid JSON file', error);
        alert('無効なJSONファイルです');
      }
    };
    reader.readAsText(file);
  };

  // 減点項目リスト(JSON)をエクスポート
  const handleExportDeductions = () => {
    const exportData = allData.deductionItemTree;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deduction-items_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="App">
      <header className="App-header">
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            DSA Grading Tool
          </Typography>
          <Box sx={{ mb: 2 }}>
            <a href="https://github.com/takoyaki65/dsa-grading-tool"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="https://img.shields.io/badge/GitHub-dsa--grading--tool-blue?style=social&logo=GitHub"
                alt="GitHub link" />
            </a>
          </Box>
        </Box>
      </header>
      <Box sx={{ p: 3, maxWidth: 1000, margin: '0 auto' }}>
        <Box sx={{ mb: 3 }}>
          <TextField
            label="totalPoints"
            type="number"
            value={allData.totalPoints}
            onChange={(e) => {
              setAllData({
                ...allData,
                totalPoints: Number(e.target.value)
              })
              localStorage.setItem('dsa-grading-tool-data', JSON.stringify(allData));
            }}
            fullWidth
            variant="outlined"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Autocomplete
            // 現在選択されている値を指定
            value={allData.studentList.find(student => student.id === selectedStudentId) || null}
            // 選択値が変更されたときの処理
            onChange={(_, newValue) => setSelectedStudentId(newValue?.id || '')}
            // 選択肢のリストを指定
            options={allData.studentList}
            // 各選択肢の表示テキストをカスタマイズ
            getOptionLabel={(option) => `${option.name} (${option.studentId})`}
            // テキストフィールドの見た目をカスタマイズ
            renderInput={(params) => (
              <TextField
                {...params}
                label="学生を選択"
                variant="outlined"
              />
            )}
            // 値の比較方法をカスタマイズ
            // 学生オブジェクトのIDで比較
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenStudentDialog}
          >
            学生を追加
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleRemoveStudent}
          >
            選択中の学生を削除
          </Button>
        </Box>

        {/* インポート関連のボタングループ */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="名簿とは、1列目に学籍番号、2列目に名前が記載されたテーブルを指します" arrow>
            <Button
              variant="contained"
              component="label"
              color="secondary"
            >
              名簿をインポート(.xlsx, .xls, .csv)
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={handleFileUpload}
              />
            </Button>
          </Tooltip>
          <Tooltip title="採点途中までのデータをセーブします" arrow>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<SaveIcon />}
              onClick={handleSaveData}
              disabled={allData.studentList.length === 0 && allData.deductionItemTree.subDeductions.length === 0}
            >
              Save Data...
            </Button>
          </Tooltip>
          <Tooltip title="セーブした採点途中のデータをロードします" arrow>
            <Button
              variant="contained"
              component="label"
              color="secondary"
              startIcon={<UploadIcon />}
            >
              Load Data...
              <input
                type="file"
                accept=".json"
                hidden
                onChange={handleLoadData}
              />
            </Button>
          </Tooltip>
          <Tooltip title="現在のデータを全て削除します" arrow>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setOpenDeleteAllDialog(true)}
              disabled={allData.studentList.length === 0 && allData.deductionItemTree.subDeductions.length === 0}
            >
              Delete Data...
            </Button>
          </Tooltip>
        </Box>

        <Typography variant="body2" color="text.secondary">
          学生数: {allData.studentList.length}
        </Typography>
      </Box>

      {/* 学生追加ダイアログ */}
      <Dialog open={openStudentDialog} onClose={handleCloseStudentDialog}>
        <DialogTitle>学生を追加</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="studentId"
              value={newStudent.studentId}
              onChange={(e) => setNewStudent({
                ...newStudent,
                studentId: e.target.value
              })}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="name"
              value={newStudent.name}
              onChange={(e) => setNewStudent({
                ...newStudent,
                name: e.target.value
              })}
              fullWidth
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStudentDialog}>キャンセル</Button>
          <Button
            onClick={handleAddStudent}
            variant="contained"
            disabled={!newStudent.studentId || !newStudent.name}
          >
            追加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 選択された学生の採点セクション */}
      {selectedStudentId && (
        <Box sx={{ width: '100%', maxWidth: '1000px', margin: '0 auto', p: 3 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenDeductionDialog(true)}
            >
              減点項目を追加
            </Button>
            <Tooltip title="減点項目のリストをJSONファイルからインポートします。{description, point, feedback}の3つのキーを持つ配列である必要があります。">
              <Button
                variant="contained"
                component="label"
                color="secondary"
                startIcon={<UploadIcon />}
              >
                減点項目リストをインポート
                <input
                  type="file"
                  accept=".json"
                  hidden
                  onChange={handleImportDeductions}
                />
              </Button>
            </Tooltip>
            <Tooltip title="減点項目のリストをJSONファイルとしてエクスポートします。">
              <Button
                variant="contained"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={handleExportDeductions}
              >
                減点項目リストをエクスポート
              </Button>
            </Tooltip>
          </Box>
          <Box sx={{ mt: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton
                onClick={() => moveToAdjacentStudent('prev')}
                disabled={!selectedStudent || students.findIndex(s => s.id === selectedStudent) === 0}
              >
                <KeyboardArrowLeftIcon />
              </IconButton>
              <Typography variant="h5" gutterBottom>
                {students.find(s => s.id === selectedStudent)?.name} ({students.find(s => s.id === selectedStudent)?.studentId}) Score: {' '}
                {students.find(s => s.id === selectedStudent) ? (
                  <ScoreDisplay
                    student={students.find(s => s.id === selectedStudent)!}
                  />
                ) : (
                  <Skeleton variant="text" width={100} height={30} />
                )}
              </Typography>
              <IconButton
                onClick={() => moveToAdjacentStudent('next')}
                disabled={!selectedStudent || students.findIndex(s => s.id === selectedStudent) === students.length - 1}
              >
                <KeyboardArrowRightIcon />
              </IconButton>
            </Box>
            <List>
              {deductionItems.map((item, index) => (
                <ListItem
                  key={item.id}
                  dense
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        edge="end"
                        onClick={() => moveDeductionItem(index, 'up')}
                        disabled={index === 0}
                      >
                        <KeyboardArrowUpIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => moveDeductionItem(index, 'down')}
                        disabled={index === deductionItems.length - 1}
                      >
                        <KeyboardArrowDownIcon />
                      </IconButton>
                      <IconButton edge="end" onClick={() => handleEditDeduction(item)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton edge="end" onClick={() => {
                        setOpenDeleteDeductionDialog(true);
                        setDeletingDeductionId(item.id);
                      }}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <Checkbox
                    edge="start"
                    checked={students.find(s => s.id === selectedStudent)?.deductions.includes(item.id) ?? false}
                    onChange={() => handleDeductionToggle(item.id)}
                  />
                  <ListItemText
                    primary={`${item.description} (-${item.points} points)`}
                  />
                </ListItem>
              ))}
            </List>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Feedback(generated):
            </Typography>
            <TextField
              multiline
              rows={4}
              value={students.find(s => s.id === selectedStudent) ? displayGeneratedFeedback(students.find(s => s.id === selectedStudent)!) : ''}
              fullWidth
              variant="outlined"
              disabled
              sx={{
                "& .MuiInputBase-input.Mui-disabled": {
                  WebkitTextFillColor: "rgba(0, 0, 0, 1)"
                }
              }}
            />
          </Box>

          {/* 追加減点フィールド */}
          <Box sx={{ mt: 2 }}>
            <TextField
              label="追加減点"
              type="number"
              value={students.find(s => s.id === selectedStudent)?.additionalDeduction ?? 0}
              onChange={(e) => handleAdditionalDeductionChange(Number(e.target.value))}
              fullWidth
              variant="outlined"
            />
          </Box>

          {/* 自由記述欄 */}
          <Box sx={{ mt: 2 }}>
            <TextField
              label="自由記述欄"
              multiline
              rows={4}
              value={students.find(s => s.id === selectedStudent)?.additionalNotes ?? ''}
              onChange={(e) => handleAdditionalNotesChange(e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Box>
        </Box>
      )}

      {/* 減点項目追加ダイアログ */}
      <Dialog open={openDeductionDialog} onClose={handleCloseDeductionDialog}>
        <DialogTitle>
          {editingDeduction ? '減点項目を編集' : '減点項目を追加'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="description"
              value={newDeduction.description}
              onChange={(e) => setNewDeduction({
                ...newDeduction,
                description: e.target.value
              })}
              fullWidth
            />
            <TextField
              label="points"
              type="number"
              value={newDeduction.points}
              onChange={(e) => setNewDeduction({
                ...newDeduction,
                points: Number(e.target.value)
              })}
              fullWidth
            />
            <TextField
              label="feedback"
              multiline
              rows={3}
              value={newDeduction.defaultFeedback}
              placeholder={!newDeduction.defaultFeedback && newDeduction.description ?
                `${newDeduction.description} (クリックまたはEnter, Tabでコピー)` :
                ''
              }
              onChange={(e) => setNewDeduction({
                ...newDeduction,
                defaultFeedback: e.target.value
              })}
              onClick={(e) => {
                // feedbackが空の場合のみdescriptionをコピー
                if (!newDeduction.defaultFeedback && newDeduction.description) {
                  setNewDeduction({
                    ...newDeduction,
                    defaultFeedback: newDeduction.description
                  });
                }
              }}
              onKeyDown={(e) => {
                // EnterキーまたはTabキーが押され、かつfeedbackが空の場合のみdescriptionをコピー
                if ((e.key === 'Enter' || e.key === 'Tab') && !newDeduction.defaultFeedback && newDeduction.description) {
                  e.preventDefault(); // デフォルトの挙動(改行入力)を防ぐ
                  setNewDeduction({
                    ...newDeduction,
                    defaultFeedback: newDeduction.description
                  });
                }
              }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeductionDialog}>キャンセル</Button>
          <Button
            onClick={handleAddOrUpdateDeduction}
            variant="contained"
            disabled={!newDeduction.description || !newDeduction.points || !newDeduction.defaultFeedback}
          >
            {editingDeduction ? '更新' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* データ削除用の確認ダイアログ */}
      <Dialog
        open={openDeleteAllDialog}
        onClose={() => setOpenDeleteAllDialog(false)}
      >
        <DialogTitle>データの削除確認</DialogTitle>
        <DialogContent>
          <Typography>
            現在のデータを全て削除します。よろしいですか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenDeleteAllDialog(false)}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleDeleteAllData}
            variant="contained"
            color="error"
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 減点項目削除用の確認ダイアログ */}
      <Dialog
        open={openDeleteDeductionDialog}
        onClose={() => {
          setOpenDeleteDeductionDialog(false);
          setDeletingDeductionId('');
        }}
      >
        <DialogTitle>減点項目の削除確認</DialogTitle>
        <DialogContent>
          <Typography>
            選択された減点項目を削除します。よろしいですか？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenDeleteDeductionDialog(false);
            setDeletingDeductionId('');
          }}>キャンセル</Button>
          <Button onClick={() => {
            handleDeleteDeduction(deletingDeductionId);
            setOpenDeleteDeductionDialog(false);
            setDeletingDeductionId('');
          }} variant="contained" color="error">削除</Button>
        </DialogActions>
      </Dialog>

      {/* エクスポート関連のボタングループ */}
      <Box sx={{ width: '100%', maxWidth: '1000px', margin: '0 auto', p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <IconButton
            onClick={() => moveToAdjacentStudent('prev', true)}
            disabled={!selectedStudent || students.findIndex(s => s.id === selectedStudent) === 0}
          >
            <KeyboardArrowLeftIcon />
          </IconButton>
          <Typography variant="h5" gutterBottom>
            {students.find(s => s.id === selectedStudent)?.name} ({students.find(s => s.id === selectedStudent)?.studentId}) : {' '}
            {students.find(s => s.id === selectedStudent) ? (
              <ScoreDisplay
                student={students.find(s => s.id === selectedStudent)!}
              />
            ) : (
              <Skeleton variant="text" width={100} height={30} />
            )}
          </Typography>
          <IconButton
            onClick={() => moveToAdjacentStudent('next', true)}
            disabled={!selectedStudent || students.findIndex(s => s.id === selectedStudent) === students.length - 1}
          >
            <KeyboardArrowRightIcon />
          </IconButton>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<DownloadIcon />}
          onClick={handleExportResults}
          disabled={students.length === 0}
        >
          採点結果をエクスポート(.xlsx)
        </Button>
      </Box>
    </div>
  );
}

export default App;
