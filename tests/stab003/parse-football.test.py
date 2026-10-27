from pathlib import Path
import importlib.util,unittest
spec=importlib.util.spec_from_file_location('football',Path(__file__).with_name('parse-football.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class Scores(unittest.TestCase):
 def read(self,line):return p.parse_text('▪ Finals\nSat May 10 2025\n  20:00 '+line,2024)['matches'][0]
 def test_regular(self):self.assertEqual(self.read('Home v Away 2-1 (1-0)')['ft'],[2,1])
 def test_extra_time(self):
  r=self.read('Home v Away 2-1 a.e.t. (1-1, 0-0)');self.assertEqual(r['ft'],[1,1]);self.assertEqual(r['ht'],[0,0])
 def test_penalties(self):
  r=self.read('Home v Away 5-4 pen. (2-2, 1-1, 0-0)');self.assertEqual(r['ft'],[1,1]);self.assertEqual(r['ht'],[0,0])
 def test_missing_90(self):self.assertIsNone(self.read('Home v Away 2-1 a.e.t.')['ft'])
 def test_postponed(self):self.assertIsNone(self.read('Home v Away [postponed]')['ft'])
 def test_old_layout(self):self.assertEqual(self.read('Home  2-1 (1-0) Away')['ht'],[1,0])
if __name__=='__main__':unittest.main()
