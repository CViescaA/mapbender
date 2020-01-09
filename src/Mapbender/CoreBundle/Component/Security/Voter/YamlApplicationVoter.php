<?php

namespace Mapbender\CoreBundle\Component\Security\Voter;

use Mapbender\CoreBundle\Entity\Application;
use Symfony\Component\Security\Acl\Domain\ObjectIdentity;
use Symfony\Component\Security\Core\Authentication\Token\AnonymousToken;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

class YamlApplicationVoter extends BaseApplicationVoter
{
    protected function supports($attribute, $subject)
    {
        // only vote on Yaml-defined Application instances
        /** @var mixed|Application $subject */
        return parent::supports($attribute, $subject) && $subject->getSource() === Application::SOURCE_YAML;
    }

    protected function voteOnAttribute($attribute, $subject, TokenInterface $token)
    {
        /** @var Application $subject */
        switch ($attribute) {
            case 'VIEW':
                if ($subject->isPublished()) {
                    return $this->voteViewPublished($subject, $token);
                } else {
                    return $this->voteViewUnpublished($subject, $token);
                }
            case 'EDIT':
            case 'DELETE':
                // deny access to impossible actions
                return false;
            default:
                return parent::voteOnAttribute($attribute, $subject, $token);
        }
    }

    /**
     * Decide on view grant for published Application.
     *
     * @param Application $subject guaranteed to be Yaml-based (see supports)
     * @param TokenInterface $token
     * @return bool true for grant, false for deny (cannot abstain here)
     */
    protected function voteViewPublished(Application $subject, TokenInterface $token)
    {
        return true;
    }

    /**
     * Decide on view grant for unpublished Application.
     *
     * @param Application $subject guaranteed to be Yaml-based (see supports)
     * @param TokenInterface $token
     * @return bool true for grant, false for deny (cannot abstain here)
     */
    protected function voteViewUnpublished(Application $subject, TokenInterface $token)
    {
        $appRoles = $this->getApplicationRoles($subject);
        if ($token instanceof AnonymousToken) {
            return in_array('IS_AUTHENTICATED_ANONYMOUSLY', $appRoles);
        }
        $allowedRoles = $this->getRoleNamesFromToken($token);
        if (!!\array_intersect($allowedRoles, $appRoles)) {
            return true;
        }
        foreach (array_diff($appRoles, $allowedRoles) as $grantingRole) {
            // use access decision manager to resolve / utilize standard role inflections
            // like e.g. any logged-in user => ROLE_USER and IS_AUTHENTICATED_ANONYMOUSLY
            if ($this->accessDecisionManager->decide($token, array($grantingRole))) {
                return true;
            }
        }

        // Legacy quirks mode: forward to EDIT grant on OID (=user has grant to EDIT all Applications globally)
        $aclTarget = ObjectIdentity::fromDomainObject($subject);
        return $this->accessDecisionManager->decide($token, array('EDIT'), $aclTarget);
    }

    /**
     * Should return role identifier strings for given $application.
     * Override this for completely special sauce VIEW-grant logic
     *
     * @param Application $application guaranteed to be Yaml-based (see supports)
     * @return string[]
     */
    protected function getApplicationRoles(Application $application)
    {
        // @todo: get this (unpersistable) information out of the entity, into a separate container parameter map
        return $application->getYamlRoles() ?: array();
    }

    protected function getSupportedAttributes(Application $subject)
    {
        return array_unique(array_merge(parent::getSupportedAttributes($subject), array(
            'VIEW',
            'EDIT',
            'DELETE',
        )));
    }

    protected function voteOnClone(Application $application, TokenInterface $token)
    {
        // Require edit grant on Application OID (no object ACLs assignable to Yaml-defined Apps, OID not discoverable)
        return parent::voteOnClone($application, $token) && $this->getOidGrant('EDIT', $token);
    }
}
