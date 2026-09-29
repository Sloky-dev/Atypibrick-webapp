import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

with patch('os.geteuid', return_value=1000, create=True):
    spec = importlib.util.spec_from_file_location('deployment', Path(__file__).with_name('deploy.py'))
    deployment = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(deployment)


class ActivationTests(unittest.TestCase):
    def test_success_retains_previous_container(self):
        with patch.object(deployment, 'docker') as docker, \
             patch.object(deployment, 'start'), patch.object(deployment, 'healthy'), \
             patch.object(deployment, 'check'), patch.object(deployment, 'public_check'):
            deployment.activate('image', Path('/snapshot'), 'previous')
        self.assertEqual([call.args for call in docker.call_args_list], [
            ('rename', deployment.PRODUCTION, 'previous'),
            ('stop', '--time', '15', 'previous')])

    def test_failed_public_check_restores_exact_previous_container(self):
        with patch.object(deployment, 'docker') as docker, \
             patch.object(deployment, 'start'), patch.object(deployment, 'healthy'), \
             patch.object(deployment, 'check'), \
             patch.object(deployment, 'public_check', side_effect=[RuntimeError('HTTP'), None]), \
             patch.object(deployment, 'exists', return_value=True), \
             patch.object(deployment.subprocess, 'run'):
            with self.assertRaisesRegex(RuntimeError, 'HTTP'):
                deployment.activate('image', Path('/snapshot'), 'previous')
        self.assertEqual([call.args for call in docker.call_args_list][-3:], [
            ('rm', '-f', deployment.PRODUCTION),
            ('rename', 'previous', deployment.PRODUCTION),
            ('start', deployment.PRODUCTION)])

    def test_start_failure_without_new_container_still_restores_old(self):
        with patch.object(deployment, 'docker') as docker, \
             patch.object(deployment, 'start', side_effect=RuntimeError('port')), \
             patch.object(deployment, 'healthy'), patch.object(deployment, 'public_check'), \
             patch.object(deployment, 'exists', return_value=False):
            with self.assertRaisesRegex(RuntimeError, 'port'):
                deployment.activate('image', Path('/snapshot'), 'previous')
        self.assertNotIn(('rm', '-f', deployment.PRODUCTION),
                         [call.args for call in docker.call_args_list])
        self.assertEqual(docker.call_args.args, ('start', deployment.PRODUCTION))


if __name__ == '__main__':
    unittest.main()
