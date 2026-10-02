import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('rotation', Path(__file__).with_name('build-static-rotation.py'))
rotation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rotation)


class StaticRotationTest(unittest.TestCase):
    def test_nested_site_build_and_upstream_drift(self):
        shell = '<script src="/static/js/main.fixture.js"></script><link href="/static/css/main.fixture.css">'
        source = 'Me.location.pathname.split("/")[1];window.location.pathname.split("/")[1];n.p="/"'
        responses = [
            (shell, 'https://socio.live/NjE3NDI=?token=fixture%26%22'),
            (source, 'https://socio.live/static/js/main.fixture.js'),
        ]
        with tempfile.TemporaryDirectory() as directory, patch.object(rotation, 'fetch', side_effect=responses):
            output = Path(directory) / 'nested/site'
            rotation.build('https://go.socio.events/fixture', output)
            wrapper = (output / 'index.html').read_text()
            self.assertIn('src="app.html?event=NjE3NDI%3D&amp;token=fixture%26%22"', wrapper)
            self.assertNotIn('@QUERY@', wrapper)
            app = (output / 'app.html').read_text()
            self.assertIn('src="app.js"', app)
            self.assertIn('https://socio.live/static/css/main.fixture.css', app)
            bundle = (output / 'app.js').read_text()
            self.assertNotIn('pathname.split', bundle)
            self.assertEqual(bundle.count('get("event")'), 2)
            self.assertIn('n.p="https://socio.live/"', bundle)
            self.assertTrue((output / '.nojekyll').is_file())
        with self.assertRaisesRegex(ValueError, 'Upstream app changed'):
            rotation.patch_bundle(source.replace('Me.location', 'Changed.location'))


if __name__ == '__main__':
    unittest.main()
