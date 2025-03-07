<?php


namespace FOM\UserBundle\Controller;


use FOM\UserBundle\Entity\User;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Base class for controllers implementing user manipulation processes
 * involving emails and tokens.
 */
abstract class AbstractEmailProcessController extends UserControllerBase
{
    /** @var \Swift_Mailer */
    protected $mailer;

    protected $emailFromAddress;
    protected $emailFromName;
    protected $isDebug;

    public function __construct(\Swift_Mailer $mailer,
                                $userEntityClass,
                                $emailFromAddress,
                                $emailFromName,
                                $isDebug)
    {
        parent::__construct($userEntityClass);
        $this->mailer = $mailer;
        $this->emailFromAddress = $emailFromAddress;
        $this->emailFromName = $emailFromName ?: $emailFromAddress;
        $this->isDebug = $isDebug;
        if (!$this->emailFromAddress) {
            $this->debug404("Sender mail not configured. See UserBundle/CONFIGURATION.md");
        }
    }

    /**
     * Throws a 404, displaying the given $message only in debug mode
     *
     * @param string|null $message
     * @throws NotFoundHttpException
     */
    protected function debug404($message)
    {
        if ($this->isDebug && $message) {
            $message = $message . ' (this message is only display in debug mode)';
            throw new NotFoundHttpException($message);
        } else {
            throw new NotFoundHttpException();
        }
    }

    /**
     * @param \DateTime $startTime
     * @param string $timeInterval
     * @return bool
     * @throws \Exception
     */
    protected function checkTimeInterval($startTime, $timeInterval)
    {
        $endTime = new \DateTime();
        $endTime->sub(new \DateInterval(sprintf("PT%dH", $timeInterval)));
        return !($startTime < $endTime);
    }

    /**
     * @param User $user
     * @return Response
     */
    protected function tokenExpired($user)
    {
        $form = $this->createForm('Symfony\Component\Form\Extension\Core\Type\FormType', null, array(
            'action' => $this->generateUrl('fom_user_password_tokenreset', array(
                'token' => $user->getResetToken(),
            )),
        ));
        return $this->render('@FOMUser/Login/error-tokenexpired.html.twig', array(
            'user' => $user,
            'form' => $form->createView(),
        ));
    }
}
