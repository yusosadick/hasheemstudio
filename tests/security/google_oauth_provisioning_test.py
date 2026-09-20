"""Synthetic provisioning checks; no vault or production environment access."""
import importlib.util
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('provision', Path(__file__).parents[2] / 'scripts/ops/provision-google-oauth.py')
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)


class GoogleProvisioningTests(unittest.TestCase):
    def item(self):
        return {'name': 'hasheemstudio-google-oauth', 'organizationId': 'synthetic-organization',
                'login': {'username': 'synthetic-client' + '.apps.googleusercontent.com',
                          'password': 'GOCSPX-' + 'synthetic-not-a-real-secret'}}

    def test_exact_organization_item_required(self):
        item = self.item()
        item['name'] = 'unrelated-item'
        with self.assertRaisesRegex(ValueError, '^exact_item_name_required$'):
            provision.credentials(item)
        item = self.item()
        item['organizationId'] = None
        with self.assertRaisesRegex(ValueError, '^organization_item_required$'):
            provision.credentials(item)

    def test_missing_and_ambiguous_credentials_are_denied(self):
        item = self.item()
        item['login']['password'] = ''
        with self.assertRaisesRegex(ValueError, '^GOOGLE_SECRET_missing_or_ambiguous$'):
            provision.credentials(item)
        item = self.item()
        item['notes'] = 'different-client' + '.apps.googleusercontent.com'
        with self.assertRaisesRegex(ValueError, '^GOOGLE_CLIENT_ID_missing_or_ambiguous$'):
            provision.credentials(item)

    def test_only_expected_keys_are_provisioned(self):
        values = provision.credentials(self.item())
        self.assertEqual(set(values), {'GOOGLE_ENABLED', 'GOOGLE_CLIENT_ID', 'GOOGLE_SECRET'})
        self.assertEqual(values['GOOGLE_ENABLED'], 'true')

    def test_unrelated_environment_is_preserved_without_duplicate_active_keys(self):
        before = '# retained\nOTHER=synthetic\nGOOGLE_ENABLED=false\nexport GOOGLE_ENABLED=false\n'
        result = provision.update_env(before, {'GOOGLE_ENABLED': 'true'})
        self.assertIn('# retained\nOTHER=synthetic\n', result)
        self.assertEqual(result.count('GOOGLE_ENABLED='), 1)
        self.assertIn('GOOGLE_ENABLED=true\n', result)


if __name__ == '__main__':
    unittest.main()
